"""Schema definition, validation, and JSON parsing for LABGUARD measurement records.

Conforms to Section 5 of authenticator.txt.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Tuple

SUPPORTED_SCHEMA = "labguard-v1"
SUPPORTED_ALGORITHM = "HMAC-SHA256"
SUPPORTED_UNIT = "C"

# Identifier regexes
ID_REGEX = re.compile(r"^[A-Za-z0-9_\-\.]{1,64}$")
KEY_ID_REGEX = re.compile(r"^[A-Za-z0-9_\-\.]{1,32}$")
TAG_REGEX = re.compile(r"^[0-9a-f]{64}$")

REQUIRED_PAYLOAD_FIELDS = {
    "schema",
    "session_id",
    "device_id",
    "seq",
    "elapsed_ms",
    "source",
    "value_centi_c",
    "unit",
    "auth",
}

REQUIRED_AUTH_FIELDS = {
    "algorithm",
    "key_id",
    "tag",
}


class SchemaValidationError(Exception):
    """Raised when a record violates the LABGUARD schema specification."""
    pass


def _reject_duplicate_keys_hook(pairs: List[Tuple[str, Any]]) -> Dict[str, Any]:
    """Custom JSON decoder hook to detect and reject duplicate keys."""
    res = {}
    for key, value in pairs:
        if key in res:
            raise SchemaValidationError(f"Duplicate JSON key detected: '{key}'")
        res[key] = value
    return res


def parse_json_line(raw_line: str) -> Dict[str, Any]:
    """Parse a single JSONL line into a Python dict, strictly rejecting duplicate keys.

    Args:
        raw_line: A single line of JSON text.

    Returns:
        Parsed dictionary.

    Raises:
        SchemaValidationError: If JSON is malformed or contains duplicate keys.
    """
    cleaned = raw_line.strip()
    if not cleaned:
        raise SchemaValidationError("Empty line: expected JSON object")

    try:
        parsed = json.loads(cleaned, object_pairs_hook=_reject_duplicate_keys_hook)
    except json.JSONDecodeError as err:
        raise SchemaValidationError(f"Malformed JSON: {err}") from err

    if not isinstance(parsed, dict):
        raise SchemaValidationError(f"Expected JSON object at top level, got {type(parsed).__name__}")

    return parsed


def validate_record_schema(record: Dict[str, Any]) -> None:
    """Validate record structure, types, and value constraints against labguard-v1.

    Args:
        record: Parsed JSON record dictionary.

    Raises:
        SchemaValidationError: If any validation rule is violated.
    """
    if not isinstance(record, dict):
        raise SchemaValidationError(f"Record must be a dictionary, got {type(record).__name__}")

    # 1. Check required fields
    missing_fields = REQUIRED_PAYLOAD_FIELDS - set(record.keys())
    if missing_fields:
        raise SchemaValidationError(f"Missing required field(s): {sorted(list(missing_fields))}")

    # 2. Reject unrecognized extra fields
    extra_fields = set(record.keys()) - REQUIRED_PAYLOAD_FIELDS
    if extra_fields:
        raise SchemaValidationError(f"Unrecognized field(s) in record: {sorted(list(extra_fields))}")

    # 3. Validate 'schema'
    if record["schema"] != SUPPORTED_SCHEMA:
        raise SchemaValidationError(
            f"Unsupported schema version '{record['schema']}': expected '{SUPPORTED_SCHEMA}'"
        )

    # 4. Validate identifiers
    for field in ("session_id", "device_id"):
        val = record[field]
        if not isinstance(val, str) or not ID_REGEX.match(val):
            raise SchemaValidationError(
                f"Field '{field}' must be a 1-64 character identifier, got {val!r}"
            )

    # 5. Validate source and unit
    if not isinstance(record["source"], str) or not record["source"].strip():
        raise SchemaValidationError(f"Field 'source' must be a non-empty string, got {record['source']!r}")

    if record["unit"] != SUPPORTED_UNIT:
        raise SchemaValidationError(
            f"Unsupported temperature unit '{record['unit']}': expected '{SUPPORTED_UNIT}'"
        )

    # 6. Validate integers (strictly rejecting bools and floats)
    seq = record["seq"]
    if isinstance(seq, bool) or not isinstance(seq, int) or seq <= 0:
        raise SchemaValidationError(f"Field 'seq' must be a positive integer, got {seq!r}")

    elapsed_ms = record["elapsed_ms"]
    if isinstance(elapsed_ms, bool) or not isinstance(elapsed_ms, int) or elapsed_ms < 0:
        raise SchemaValidationError(
            f"Field 'elapsed_ms' must be a non-negative integer, got {elapsed_ms!r}"
        )

    value_centi_c = record["value_centi_c"]
    if isinstance(value_centi_c, bool) or not isinstance(value_centi_c, int):
        raise SchemaValidationError(
            f"Field 'value_centi_c' must be an integer (hundredths of °C), got {value_centi_c!r}"
        )

    # 7. Validate 'auth' block
    auth = record["auth"]
    if not isinstance(auth, dict):
        raise SchemaValidationError(f"Field 'auth' must be an object, got {type(auth).__name__}")

    missing_auth = REQUIRED_AUTH_FIELDS - set(auth.keys())
    if missing_auth:
        raise SchemaValidationError(f"Missing required field(s) in 'auth': {sorted(list(missing_auth))}")

    extra_auth = set(auth.keys()) - REQUIRED_AUTH_FIELDS
    if extra_auth:
        raise SchemaValidationError(f"Unrecognized field(s) in 'auth': {sorted(list(extra_auth))}")

    if auth["algorithm"] != SUPPORTED_ALGORITHM:
        raise SchemaValidationError(
            f"Unsupported algorithm '{auth['algorithm']}': expected '{SUPPORTED_ALGORITHM}'"
        )

    key_id = auth["key_id"]
    if not isinstance(key_id, str) or not KEY_ID_REGEX.match(key_id):
        raise SchemaValidationError(
            f"Field 'auth.key_id' must be a 1-32 character identifier, got {key_id!r}"
        )

    tag = auth["tag"]
    if not isinstance(tag, str) or not TAG_REGEX.match(tag):
        raise SchemaValidationError(
            "Field 'auth.tag' must be a 64-character lowercase hexadecimal string"
        )
