"""Unit tests for independent verifier (labguard/verifier.py).

Verifies full-file verification, tamper detection, sequence analysis,
and error handling.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from labguard.canonical import serialize_canonical_payload
from labguard.crypto import compute_hmac
from labguard.key_manager import KeyStore
from labguard.verifier import VerificationResult, verify_evidence_file


class TestVerifier(unittest.TestCase):
    """Test suite for independent JSONL verification."""

    def setUp(self) -> None:
        self.keystore = KeyStore()
        self.key_bytes = b"\x07" * 32
        self.key_id = "KEY-VERIFY-001"
        self.keystore.add_key(self.key_id, self.key_bytes)

    def _create_record(self, seq: int, temp_centi: int, key_id: str | None = None) -> dict:
        k_id = key_id or self.key_id
        rec = {
            "schema": "labguard-v1",
            "session_id": "SESSION-TEST",
            "device_id": "DEVICE-01",
            "seq": seq,
            "elapsed_ms": seq * 1000,
            "source": "DS18B20",
            "value_centi_c": temp_centi,
            "unit": "C",
        }
        canonical = serialize_canonical_payload(rec)
        tag = compute_hmac(self.key_bytes, canonical)
        rec["auth"] = {
            "algorithm": "HMAC-SHA256",
            "key_id": k_id,
            "tag": tag,
        }
        return rec

    def test_valid_jsonl_file_passes(self) -> None:
        """Verify that an authentic, untouched JSONL file is VALID."""
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            for s in range(1, 4):
                rec = self._create_record(seq=s, temp_centi=2500 + s * 10)
                f.write(json.dumps(rec) + "\n")
            f_path = Path(f.name)

        try:
            res = verify_evidence_file(f_path, self.keystore)
            self.assertEqual(res.status, VerificationResult.VALID)
            self.assertEqual(res.valid_count, 3)
            self.assertEqual(res.invalid_count, 0)
            self.assertEqual(len(res.sequence_issues), 0)
        finally:
            f_path.unlink()

    def test_tampered_measurement_fails(self) -> None:
        """Verify that modified measurement value on line 2 is marked INVALID."""
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            rec1 = self._create_record(seq=1, temp_centi=2500)
            rec2 = self._create_record(seq=2, temp_centi=2510)
            # Tamper with rec2 measurement value without updating HMAC tag
            rec2["value_centi_c"] = 9999
            rec3 = self._create_record(seq=3, temp_centi=2520)

            f.write(json.dumps(rec1) + "\n")
            f.write(json.dumps(rec2) + "\n")
            f.write(json.dumps(rec3) + "\n")
            f_path = Path(f.name)

        try:
            res = verify_evidence_file(f_path, self.keystore)
            self.assertEqual(res.status, VerificationResult.INVALID)
            self.assertEqual(res.valid_count, 2)
            self.assertEqual(res.invalid_count, 1)
            self.assertIsNotNone(res.first_failure)
            self.assertEqual(res.first_failure["line_num"], 2)
        finally:
            f_path.unlink()

    def test_unknown_key_id_fails_closed(self) -> None:
        """Verify that a record signed with an unknown key ID results in UNVERIFIABLE."""
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            rec = self._create_record(seq=1, temp_centi=2500, key_id="KEY-UNKNOWN-999")
            f.write(json.dumps(rec) + "\n")
            f_path = Path(f.name)

        try:
            res = verify_evidence_file(f_path, self.keystore)
            self.assertEqual(res.status, VerificationResult.UNVERIFIABLE)
            self.assertEqual(res.unverifiable_count, 1)
            self.assertEqual(res.first_failure["line_num"], 1)
        finally:
            f_path.unlink()

    def test_sequence_anomaly_detected(self) -> None:
        """Verify that sequence gaps and duplicates are detected."""
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            rec1 = self._create_record(seq=1, temp_centi=2500)
            rec3 = self._create_record(seq=3, temp_centi=2520)  # Gap: missing seq 2
            f.write(json.dumps(rec1) + "\n")
            f.write(json.dumps(rec3) + "\n")
            f_path = Path(f.name)

        try:
            res = verify_evidence_file(f_path, self.keystore)
            self.assertEqual(res.status, VerificationResult.INVALID)
            self.assertTrue(any("Sequence gap" in issue for issue in res.sequence_issues))
        finally:
            f_path.unlink()

    def test_empty_file_unverifiable(self) -> None:
        """Verify that an empty evidence file is marked UNVERIFIABLE."""
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f_path = Path(f.name)

        try:
            res = verify_evidence_file(f_path, self.keystore)
            self.assertEqual(res.status, VerificationResult.UNVERIFIABLE)
        finally:
            f_path.unlink()


if __name__ == "__main__":
    unittest.main()
