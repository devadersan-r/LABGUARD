"""Unit tests for schema parsing and validation (labguard/schema.py).

Verifies strict type enforcement, duplicate key rejection, and identifier validation.
"""

from __future__ import annotations

import unittest
from labguard.schema import (
    SchemaValidationError,
    parse_json_line,
    validate_record_schema,
)


class TestSchemaValidation(unittest.TestCase):
    """Test suite for record schema validation."""

    def setUp(self) -> None:
        self.valid_record = {
            "schema": "labguard-v1",
            "session_id": "SESSION-001",
            "device_id": "DEVICE-01",
            "seq": 1,
            "elapsed_ms": 1000,
            "source": "DS18B20",
            "value_centi_c": 2850,
            "unit": "C",
            "auth": {
                "algorithm": "HMAC-SHA256",
                "key_id": "KEY-001",
                "tag": "a" * 64,
            },
        }

    def test_valid_record_passes(self) -> None:
        """Verify that a schema-conforming record passes validation."""
        validate_record_schema(self.valid_record)

    def test_duplicate_json_keys_rejected(self) -> None:
        """Verify that duplicate keys in JSON are rejected."""
        dup_json = '{"schema":"labguard-v1","seq":1,"seq":2,"session_id":"S1"}'
        with self.assertRaises(SchemaValidationError):
            parse_json_line(dup_json)

    def test_missing_required_fields_rejected(self) -> None:
        """Verify that missing fields raise SchemaValidationError."""
        bad = dict(self.valid_record)
        del bad["value_centi_c"]
        with self.assertRaises(SchemaValidationError):
            validate_record_schema(bad)

    def test_extra_fields_rejected(self) -> None:
        """Verify that unrecognized extra fields raise SchemaValidationError."""
        bad = dict(self.valid_record)
        bad["unexpected_extra_field"] = "malicious_payload"
        with self.assertRaises(SchemaValidationError):
            validate_record_schema(bad)

    def test_invalid_unit_rejected(self) -> None:
        """Verify that units other than 'C' are rejected."""
        bad = dict(self.valid_record)
        bad["unit"] = "F"
        with self.assertRaises(SchemaValidationError):
            validate_record_schema(bad)

    def test_boolean_for_seq_rejected(self) -> None:
        """Verify that booleans are rejected for 'seq'."""
        bad = dict(self.valid_record)
        bad["seq"] = True
        with self.assertRaises(SchemaValidationError):
            validate_record_schema(bad)

    def test_negative_seq_rejected(self) -> None:
        """Verify that zero or negative sequence numbers are rejected."""
        bad = dict(self.valid_record)
        bad["seq"] = 0
        with self.assertRaises(SchemaValidationError):
            validate_record_schema(bad)

    def test_invalid_auth_algorithm_rejected(self) -> None:
        """Verify that algorithms other than HMAC-SHA256 are rejected."""
        bad = dict(self.valid_record)
        bad["auth"] = dict(self.valid_record["auth"])
        bad["auth"]["algorithm"] = "PLAIN-SHA256"
        with self.assertRaises(SchemaValidationError):
            validate_record_schema(bad)

    def test_malformed_auth_tag_rejected(self) -> None:
        """Verify that tags not matching 64 lowercase hex characters are rejected."""
        bad = dict(self.valid_record)
        bad["auth"] = dict(self.valid_record["auth"])
        bad["auth"]["tag"] = "A" * 64  # Uppercase not permitted
        with self.assertRaises(SchemaValidationError):
            validate_record_schema(bad)

        bad["auth"]["tag"] = "a" * 63  # Too short
        with self.assertRaises(SchemaValidationError):
            validate_record_schema(bad)


if __name__ == "__main__":
    unittest.main()
