"""Independent Python verification engine for LABGUARD evidence records.

Conforms to Section 10 of authenticator.txt and Section 8 of correction.txt.
Treats evidence files as untrusted, parses line-by-line, verifies HMAC tags against
canonical byte serialization, checks sequence consistency, and reports comprehensive diagnostics.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from labguard.canonical import CanonicalizationError, serialize_canonical_payload
from labguard.crypto import InvalidKeyError, InvalidTagError, verify_hmac
from labguard.key_manager import KeyNotFoundError, KeyStore
from labguard.schema import SchemaValidationError, parse_json_line, validate_record_schema


class VerificationResult:
    """Summary of evidence file verification."""

    VALID = "VALID"
    INVALID = "INVALID"
    UNVERIFIABLE = "INCOMPLETE/UNVERIFIABLE"

    def __init__(self, filename: str) -> None:
        self.filename: str = filename
        self.status: str = self.UNVERIFIABLE
        self.total_lines: int = 0
        self.valid_count: int = 0
        self.invalid_count: int = 0
        self.unverifiable_count: int = 0
        self.line_results: List[Dict[str, Any]] = []
        self.first_failure: Optional[Dict[str, Any]] = None
        self.sequence_issues: List[str] = []

    def finalize(self) -> None:
        """Determine overall verification status based on strict criteria."""
        if self.total_lines == 0:
            self.status = self.UNVERIFIABLE
            return

        if self.invalid_count > 0 or len(self.sequence_issues) > 0:
            self.status = self.INVALID
        elif self.unverifiable_count > 0:
            self.status = self.UNVERIFIABLE
        elif self.valid_count == self.total_lines and self.valid_count > 0:
            self.status = self.VALID
        else:
            self.status = self.INVALID

    def to_dict(self) -> Dict[str, Any]:
        return {
            "filename": self.filename,
            "status": self.status,
            "total_lines": self.total_lines,
            "valid_records": self.valid_count,
            "invalid_records": self.invalid_count,
            "unverifiable_records": self.unverifiable_count,
            "first_failure": self.first_failure,
            "sequence_issues": self.sequence_issues,
            "records": self.line_results,
        }


def verify_evidence_file(
    file_path: Union[str, Path],
    keystore: Optional[KeyStore] = None,
) -> VerificationResult:
    """Independently verify an evidence file containing JSONL records.

    Args:
        file_path: Path to JSONL file.
        keystore: Optional KeyStore instance. If None, default keystore is used.

    Returns:
        VerificationResult with overall status and line-by-line diagnostics.
    """
    path = Path(file_path).resolve()
    result = VerificationResult(filename=str(path))

    if not path.exists():
        result.status = VerificationResult.UNVERIFIABLE
        result.sequence_issues.append(f"Evidence file not found: {path}")
        return result

    if keystore is None:
        default_store_path = path.parent.parent / "keys" / "labguard_keys.json"
        keystore = KeyStore(default_store_path if default_store_path.exists() else None)

    # Read and verify records line by line
    current_session: Optional[str] = None
    last_seq: Optional[int] = None
    seen_seqs: set[int] = set()

    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    result.total_lines = len(lines)
    if result.total_lines == 0:
        result.status = VerificationResult.UNVERIFIABLE
        result.sequence_issues.append("Evidence file is empty (0 records).")
        return result

    for idx, raw_line in enumerate(lines, start=1):
        line_str = raw_line.strip()
        record_info: Dict[str, Any] = {
            "line_num": idx,
            "status": "UNVERIFIABLE",
            "seq": None,
            "value_centi_c": None,
            "temp_c": None,
            "error_reason": None,
        }

        if not line_str:
            record_info["status"] = "INVALID"
            record_info["error_reason"] = "Empty or whitespace line in JSONL file"
            result.invalid_count += 1
            if not result.first_failure:
                result.first_failure = record_info
            result.line_results.append(record_info)
            continue

        # 1. Parse JSON and reject duplicate keys
        try:
            record = parse_json_line(line_str)
        except SchemaValidationError as err:
            record_info["status"] = "INVALID"
            record_info["error_reason"] = f"JSON/Schema error: {err}"
            result.invalid_count += 1
            if not result.first_failure:
                result.first_failure = record_info
            result.line_results.append(record_info)
            continue

        # 2. Validate schema
        try:
            validate_record_schema(record)
        except SchemaValidationError as err:
            record_info["status"] = "INVALID"
            record_info["error_reason"] = f"Schema validation error: {err}"
            result.invalid_count += 1
            if not result.first_failure:
                result.first_failure = record_info
            result.line_results.append(record_info)
            continue

        seq = record["seq"]
        record_info["seq"] = seq
        record_info["value_centi_c"] = record["value_centi_c"]
        record_info["temp_c"] = round(record["value_centi_c"] / 100.0, 2)

        # 3. Session and sequence tracking
        session_id = record["session_id"]
        if current_session is None:
            current_session = session_id
        elif session_id != current_session:
            result.sequence_issues.append(
                f"Line {idx}: Session mismatch (saw '{session_id}', expected '{current_session}')"
            )

        if seq in seen_seqs:
            result.sequence_issues.append(f"Line {idx}: Duplicate sequence number {seq}")
        seen_seqs.add(seq)

        if last_seq is not None:
            if seq <= last_seq:
                result.sequence_issues.append(
                    f"Line {idx}: Out-of-order sequence (saw {seq} after {last_seq})"
                )
            elif seq > last_seq + 1:
                result.sequence_issues.append(
                    f"Line {idx}: Sequence gap detected (expected {last_seq + 1}, got {seq})"
                )
        last_seq = seq

        # 4. Resolve key by key_id
        key_id = record["auth"]["key_id"]
        try:
            secret_key = keystore.get_key(key_id)
        except KeyNotFoundError:
            record_info["status"] = "UNVERIFIABLE"
            record_info["error_reason"] = f"Unknown key identifier '{key_id}': not in key store"
            result.unverifiable_count += 1
            if not result.first_failure:
                result.first_failure = record_info
            result.line_results.append(record_info)
            continue
        except InvalidKeyError as err:
            record_info["status"] = "INVALID"
            record_info["error_reason"] = f"Invalid key material for '{key_id}': {err}"
            result.invalid_count += 1
            if not result.first_failure:
                result.first_failure = record_info
            result.line_results.append(record_info)
            continue

        # 5. Canonicalize payload bytes
        try:
            canonical_bytes = serialize_canonical_payload(record)
        except CanonicalizationError as err:
            record_info["status"] = "INVALID"
            record_info["error_reason"] = f"Canonical serialization failed: {err}"
            result.invalid_count += 1
            if not result.first_failure:
                result.first_failure = record_info
            result.line_results.append(record_info)
            continue

        # 6. Verify HMAC tag
        supplied_tag = record["auth"]["tag"]
        try:
            is_valid = verify_hmac(secret_key, canonical_bytes, supplied_tag)
        except (InvalidTagError, InvalidKeyError) as err:
            record_info["status"] = "INVALID"
            record_info["error_reason"] = f"Tag verification error: {err}"
            result.invalid_count += 1
            if not result.first_failure:
                result.first_failure = record_info
            result.line_results.append(record_info)
            continue

        if is_valid:
            record_info["status"] = "VALID"
            result.valid_count += 1
        else:
            record_info["status"] = "INVALID"
            record_info["error_reason"] = "HMAC authentication tag mismatch (tampering detected)"
            result.invalid_count += 1
            if not result.first_failure:
                result.first_failure = record_info

        result.line_results.append(record_info)

    result.finalize()
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Independently verify LABGUARD JSONL measurement evidence files.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("evidence_file", type=Path, help="Path to evidence JSONL file")
    parser.add_argument(
        "--key-store",
        type=Path,
        default=None,
        help="Optional path to custom JSON key store file",
    )
    args = parser.parse_args()

    keystore = KeyStore(args.key_store) if args.key_store else None
    result = verify_evidence_file(args.evidence_file, keystore)

    print("=================================================================")
    print("               LABGUARD Independent Verifier                     ")
    print("=================================================================")
    print(f"File Checked      : {result.filename}")
    print(f"Overall Status    : {result.status}")
    print(f"Total Lines       : {result.total_lines}")
    print(f"Valid Records     : {result.valid_count}")
    print(f"Invalid Records   : {result.invalid_count}")
    print(f"Unverifiable Recs : {result.unverifiable_count}")

    if result.sequence_issues:
        print("\n[!] Sequence / Session Warnings:")
        for issue in result.sequence_issues:
            print(f"    - {issue}")

    if result.first_failure:
        print("\n[!] First Failure:")
        ff = result.first_failure
        print(f"    Line Number : {ff['line_num']}")
        print(f"    Status      : {ff['status']}")
        print(f"    Reason      : {ff['error_reason']}")

    print("-----------------------------------------------------------------")
    print("Record Verification Details:")
    print(f"{'Line':<6} {'Seq':<6} {'Temp (°C)':<12} {'Status':<14} {'Notes'}")
    print("-" * 65)
    for r in result.line_results:
        temp_str = f"{r['temp_c']} °C" if r['temp_c'] is not None else "N/A"
        seq_str = str(r['seq']) if r['seq'] is not None else "N/A"
        notes = r['error_reason'] if r['error_reason'] else "HMAC Verified"
        print(f"{r['line_num']:<6} {seq_str:<6} {temp_str:<12} {r['status']:<14} {notes}")
    print("=================================================================\n")

    return 0 if result.status == VerificationResult.VALID else 1


if __name__ == "__main__":
    sys.exit(main())
