"""Canonical serialization specification and generator for LABGUARD.

Defines deterministic, byte-for-byte identical payload serialization between
Python and Arduino ESP32 C++ firmware.

Conforms to Section 5 of authenticator.txt and Section 6 of correction.txt.
"""

from __future__ import annotations

import json
from typing import Any, Dict

SUPPORTED_SCHEMA = "labguard-v1"

# Canonical field sequence for labguard-v1
CANONICAL_FIELD_ORDER = (
    "schema",
    "session_id",
    "device_id",
    "seq",
    "elapsed_ms",
    "source",
    "value_centi_c",
    "unit",
)


class CanonicalizationError(Exception):
    """Raised when record data cannot be canonically serialized."""
    pass


def serialize_canonical_payload(record: Dict[str, Any]) -> bytes:
    """Serialize record payload into deterministic canonical UTF-8 bytes for HMAC computation.

    Rules:
    1. Covers authenticated payload fields in exact fixed order:
       schema, session_id, device_id, seq, elapsed_ms, source, value_centi_c, unit.
    2. Excludes the 'auth' block.
    3. No insignificant whitespace (separators=(',', ':')).
    4. Integers are formatted as standard base-10 without leading zeros.
       - Temperature is strictly integer hundredths of a degree Celsius (value_centi_c).
    5. UTF-8 encoded without BOM.

    Args:
        record: Dictionary representing the measurement record.

    Returns:
        Deterministic bytes representation.

    Raises:
        CanonicalizationError: If required fields are missing or invalid types.
    """
    if not isinstance(record, dict):
        raise CanonicalizationError(f"Record must be a dictionary, got {type(record).__name__}")

    # Verify schema version
    schema_version = record.get("schema")
    if schema_version != SUPPORTED_SCHEMA:
        raise CanonicalizationError(
            f"Unsupported schema '{schema_version}': expected '{SUPPORTED_SCHEMA}'"
        )

    # Extract and validate fields
    try:
        session_id = str(record["session_id"])
        device_id = str(record["device_id"])
        seq = record["seq"]
        elapsed_ms = record["elapsed_ms"]
        source = str(record["source"])
        value_centi_c = record["value_centi_c"]
        unit = str(record["unit"])
    except KeyError as err:
        raise CanonicalizationError(f"Missing required field in payload: {err}") from err

    # Strict type checks: reject booleans where integers are expected
    if isinstance(seq, bool) or not isinstance(seq, int) or seq <= 0:
        raise CanonicalizationError(f"Field 'seq' must be a positive integer, got {seq!r}")

    if isinstance(elapsed_ms, bool) or not isinstance(elapsed_ms, int) or elapsed_ms < 0:
        raise CanonicalizationError(f"Field 'elapsed_ms' must be a non-negative integer, got {elapsed_ms!r}")

    if isinstance(value_centi_c, bool) or not isinstance(value_centi_c, int):
        raise CanonicalizationError(
            f"Field 'value_centi_c' must be an integer, got {value_centi_c!r}"
        )

    # Construct ordered dict for canonical dump
    ordered_payload = {
        "schema": schema_version,
        "session_id": session_id,
        "device_id": device_id,
        "seq": seq,
        "elapsed_ms": elapsed_ms,
        "source": source,
        "value_centi_c": value_centi_c,
        "unit": unit,
    }

    # Deterministic JSON serialization: no whitespace, UTF-8
    canonical_json = json.dumps(
        ordered_payload,
        ensure_ascii=False,
        separators=(",", ":"),
    )

    return canonical_json.encode("utf-8")


# =============================================================================
# SHARED TEST VECTORS (Dedicated deterministic public test key - NEVER a secret)
# =============================================================================
SHARED_TEST_KEY_HEX = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"
SHARED_TEST_KEY_ID = "KEY-TEST-VEC"

SHARED_TEST_VECTORS = [
    {
        "description": "Standard positive temperature measurement (28.50 C)",
        "record": {
            "schema": "labguard-v1",
            "session_id": "SESSION-TEST-001",
            "device_id": "DEVICE-01",
            "seq": 1,
            "elapsed_ms": 1000,
            "source": "DS18B20",
            "value_centi_c": 2850,
            "unit": "C",
        },
        "canonical_bytes": b'{"schema":"labguard-v1","session_id":"SESSION-TEST-001","device_id":"DEVICE-01","seq":1,"elapsed_ms":1000,"source":"DS18B20","value_centi_c":2850,"unit":"C"}',
        # Expected HMAC-SHA256 with SHARED_TEST_KEY_HEX
        "expected_tag": "6a2a0011d6cdca2c060ad20d79970c1f4f035c411a8d119c4844418ec6761f1b",
    },
    {
        "description": "Sub-zero temperature measurement (-5.25 C)",
        "record": {
            "schema": "labguard-v1",
            "session_id": "SESSION-TEST-001",
            "device_id": "DEVICE-01",
            "seq": 2,
            "elapsed_ms": 2000,
            "source": "DS18B20",
            "value_centi_c": -525,
            "unit": "C",
        },
        "canonical_bytes": b'{"schema":"labguard-v1","session_id":"SESSION-TEST-001","device_id":"DEVICE-01","seq":2,"elapsed_ms":2000,"source":"DS18B20","value_centi_c":-525,"unit":"C"}',
        "expected_tag": "0881a3ce639eee2f47519e7f4129cab4bac66e7d5ebae81a738bfa948f63ce21",
    },
    {
        "description": "Initial zero elapsed time reading (0.00 C)",
        "record": {
            "schema": "labguard-v1",
            "session_id": "SESSION-LAB-99",
            "device_id": "ESP32-NODE-A",
            "seq": 100,
            "elapsed_ms": 0,
            "source": "DS18B20",
            "value_centi_c": 0,
            "unit": "C",
        },
        "canonical_bytes": b'{"schema":"labguard-v1","session_id":"SESSION-LAB-99","device_id":"ESP32-NODE-A","seq":100,"elapsed_ms":0,"source":"DS18B20","value_centi_c":0,"unit":"C"}',
        "expected_tag": "ebc307c8edc82fb4c74b44790b86823f0a7a6b2888278f4ac094c80c9ad9386f",
    },
]
