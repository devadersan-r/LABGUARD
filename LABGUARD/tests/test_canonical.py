"""Unit tests for canonical serialization and shared test vectors.

Verifies that Python canonical serialization reproduces byte-for-byte identical
payloads matching the shared test vectors used by ESP32 firmware.

Conforms to Section 6 and Section 9 (Test 10 & 13) of correction.txt.
"""

from __future__ import annotations

import unittest
from labguard.canonical import (
    SHARED_TEST_KEY_HEX,
    SHARED_TEST_VECTORS,
    CanonicalizationError,
    serialize_canonical_payload,
)
from labguard.crypto import compute_hmac, verify_hmac


class TestCanonicalSerialization(unittest.TestCase):
    """Test suite for canonical serialization and shared test vectors."""

    def test_shared_test_vectors(self) -> None:
        """Verify Python canonicalization matches the shared byte-level test vectors."""
        test_key_bytes = bytes.fromhex(SHARED_TEST_KEY_HEX)

        for vec in SHARED_TEST_VECTORS:
            desc = vec["description"]
            record = vec["record"]
            expected_bytes = vec["canonical_bytes"]
            expected_tag = vec["expected_tag"]

            # 1. Byte-level exact canonical serialization check
            actual_bytes = serialize_canonical_payload(record)
            self.assertEqual(actual_bytes, expected_bytes, f"Byte mismatch for vector: {desc}")

            # 2. Cryptographic HMAC-SHA256 authentication tag check
            computed_tag = compute_hmac(test_key_bytes, actual_bytes)
            self.assertEqual(computed_tag, expected_tag, f"HMAC mismatch for vector: {desc}")
            self.assertTrue(verify_hmac(test_key_bytes, actual_bytes, expected_tag))

    def test_rejection_of_boolean_for_integers(self) -> None:
        """Verify that booleans are strictly rejected where integers are required."""
        bad_record_seq = {
            "schema": "labguard-v1",
            "session_id": "SESSION-001",
            "device_id": "DEVICE-01",
            "seq": True,  # Invalid: bool instead of int
            "elapsed_ms": 1000,
            "source": "DS18B20",
            "value_centi_c": 2500,
            "unit": "C",
        }
        with self.assertRaises(CanonicalizationError):
            serialize_canonical_payload(bad_record_seq)

        bad_record_temp = dict(bad_record_seq)
        bad_record_temp["seq"] = 1
        bad_record_temp["value_centi_c"] = False
        with self.assertRaises(CanonicalizationError):
            serialize_canonical_payload(bad_record_temp)

    def test_rejection_of_floats(self) -> None:
        """Verify that floating-point temperature values are rejected (must be integer value_centi_c)."""
        bad_record_float = {
            "schema": "labguard-v1",
            "session_id": "SESSION-001",
            "device_id": "DEVICE-01",
            "seq": 1,
            "elapsed_ms": 1000,
            "source": "DS18B20",
            "value_centi_c": 28.50,  # Invalid: float instead of int
            "unit": "C",
        }
        with self.assertRaises(CanonicalizationError):
            serialize_canonical_payload(bad_record_float)

    def test_missing_fields(self) -> None:
        """Verify that missing payload fields raise CanonicalizationError."""
        incomplete = {
            "schema": "labguard-v1",
            "session_id": "SESSION-001",
            "device_id": "DEVICE-01",
            # missing seq, elapsed_ms, etc.
        }
        with self.assertRaises(CanonicalizationError):
            serialize_canonical_payload(incomplete)


if __name__ == "__main__":
    unittest.main()
