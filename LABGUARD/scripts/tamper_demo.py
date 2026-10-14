#!/usr/bin/env python3
"""LABGUARD Tamper Detection Demonstration.

Demonstrates:
1. Verification of an authentic, untouched evidence file (Result: VALID).
2. Tamper detection on a modified copy with altered temperature (Result: INVALID).
3. Fail-closed rejection of a record using an unknown key ID (Result: INCOMPLETE/UNVERIFIABLE).

Never alters the original evidence file.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from labguard.key_manager import DEFAULT_KEY_ID, KeyStore
from labguard.verifier import verify_evidence_file
from scripts.create_demo_evidence import generate_sample_records


def run_demonstration() -> int:
    evidence_dir = PROJECT_ROOT / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    keystore_path = PROJECT_ROOT / "keys" / "labguard_keys.json"

    keystore = KeyStore(keystore_path)
    if not keystore.has_key(DEFAULT_KEY_ID):
        print(f"[!] Key '{DEFAULT_KEY_ID}' not in key store. Generating fresh key first...")
        from labguard.key_manager import generate_secret_key
        k = generate_secret_key(DEFAULT_KEY_ID)
        keystore.add_key(DEFAULT_KEY_ID, bytes.fromhex(k["key_hex"]))
        keystore.save_to_file(keystore_path)

    # 1. Create original valid evidence file
    valid_file = evidence_dir / "demo_valid.jsonl"
    records = generate_sample_records(keystore, DEFAULT_KEY_ID, record_count=5)
    with open(valid_file, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, separators=(",", ":")) + "\n")

    # 2. Create tampered copy (modify measurement on record #3 without updating tag)
    tampered_file = evidence_dir / "demo_tampered.jsonl"
    with open(valid_file, "r", encoding="utf-8") as f_in, open(tampered_file, "w", encoding="utf-8") as f_out:
        for idx, line in enumerate(f_in, start=1):
            obj = json.loads(line)
            if idx == 3:
                # Modify temperature value from ~24.50°C to 99.99°C
                obj["value_centi_c"] = 9999
            f_out.write(json.dumps(obj, separators=(",", ":")) + "\n")

    # 3. Create unknown key copy
    unknown_key_file = evidence_dir / "demo_unknown_key.jsonl"
    with open(valid_file, "r", encoding="utf-8") as f_in, open(unknown_key_file, "w", encoding="utf-8") as f_out:
        for idx, line in enumerate(f_in, start=1):
            obj = json.loads(line)
            if idx == 2:
                obj["auth"]["key_id"] = "KEY-ROGUE-999"
            f_out.write(json.dumps(obj, separators=(",", ":")) + "\n")

    print("=================================================================")
    print("           LABGUARD Tamper Detection Demonstration               ")
    print("=================================================================")

    # Test 1: Original file
    res1 = verify_evidence_file(valid_file, keystore)
    print(f"\n[Scenario 1: Untouched Evidence File]")
    print(f"File   : {valid_file.name}")
    print(f"Result : {res1.status} ({res1.valid_count}/{res1.total_lines} authenticated)")
    assert res1.status == "VALID", f"Expected VALID, got {res1.status}"

    # Test 2: Tampered file
    res2 = verify_evidence_file(tampered_file, keystore)
    print(f"\n[Scenario 2: Tampered Evidence File (line 3 temperature modified)]")
    print(f"File   : {tampered_file.name}")
    print(f"Result : {res2.status} ({res2.invalid_count} invalid records)")
    if res2.first_failure:
        print(f"Failure: Line {res2.first_failure['line_num']} - {res2.first_failure['error_reason']}")
    assert res2.status == "INVALID", f"Expected INVALID, got {res2.status}"

    # Test 3: Unknown key ID
    res3 = verify_evidence_file(unknown_key_file, keystore)
    print(f"\n[Scenario 3: Unknown Key Identifier (line 2 key ID altered)]")
    print(f"File   : {unknown_key_file.name}")
    print(f"Result : {res3.status} ({res3.unverifiable_count} unverifiable records)")
    if res3.first_failure:
        print(f"Failure: Line {res3.first_failure['line_num']} - {res3.first_failure['error_reason']}")
    assert res3.status == "INCOMPLETE/UNVERIFIABLE", f"Expected INCOMPLETE/UNVERIFIABLE, got {res3.status}"

    print("\n-----------------------------------------------------------------")
    print("DEMONSTRATION CONCLUSION:")
    print("✔ Original evidence verified with zero discrepancies.")
    print("✔ Unauthorized modification of a single measurement was detected.")
    print("✔ Unknown key identifier failed closed (cannot bypass with generic key).")
    print("=================================================================\n")
    return 0


if __name__ == "__main__":
    sys.exit(run_demonstration())
