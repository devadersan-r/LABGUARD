#!/usr/bin/env python3
"""Create sample evidence files for LABGUARD demonstrations.

Generates clearly labelled simulated laboratory temperature records authenticated
with the provisioned development key.

Usage:
    python3 scripts/create_demo_evidence.py
    python3 scripts/create_demo_evidence.py --output evidence/sample.jsonl --count 10
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from labguard.canonical import serialize_canonical_payload
from labguard.crypto import compute_hmac
from labguard.key_manager import DEFAULT_KEY_ID, KeyStore


def generate_sample_records(
    keystore: KeyStore,
    key_id: str,
    record_count: int = 5,
    session_id: str = "SESSION-SIM-001",
    device_id: str = "ESP32-SIM-01",
) -> list[dict]:
    """Generate authenticated simulated measurement records."""
    key_bytes = keystore.get_key(key_id)
    records = []

    # Simulated realistic temperature sequence around 24.50°C
    simulated_temperatures_centi = [2415, 2430, 2450, 2480, 2470, 2465, 2455, 2460]

    for i in range(1, record_count + 1):
        temp_val = simulated_temperatures_centi[(i - 1) % len(simulated_temperatures_centi)]
        record = {
            "schema": "labguard-v1",
            "session_id": session_id,
            "device_id": device_id,
            "seq": i,
            "elapsed_ms": (i - 1) * 2000,
            "source": "DS18B20-SIMULATED",
            "value_centi_c": temp_val,
            "unit": "C",
        }

        # Canonicalize payload and calculate real HMAC-SHA256
        canonical_bytes = serialize_canonical_payload(record)
        tag = compute_hmac(key_bytes, canonical_bytes)

        record["auth"] = {
            "algorithm": "HMAC-SHA256",
            "key_id": key_id,
            "tag": tag,
        }
        records.append(record)

    return records


def main() -> int:
    parser = argparse.ArgumentParser(description="Create authentic sample LABGUARD JSONL evidence.")
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "evidence" / "demo_valid.jsonl",
        help="Path for generated JSONL evidence file",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=5,
        help="Number of records to generate",
    )
    parser.add_argument(
        "--key-id",
        type=str,
        default=DEFAULT_KEY_ID,
        help="Key identifier to sign records with",
    )
    parser.add_argument(
        "--key-store",
        type=Path,
        default=PROJECT_ROOT / "keys" / "labguard_keys.json",
        help="Path to JSON key store",
    )
    args = parser.parse_args()

    keystore = KeyStore(args.key_store)
    if not keystore.has_key(args.key_id):
        sys.stderr.write(
            f"[!] Error: Key identifier '{args.key_id}' not found in {args.key_store}.\n"
            f"    Run 'python3 scripts/generate_key.py --key-id {args.key_id}' first.\n"
        )
        return 1

    records = generate_sample_records(keystore, args.key_id, args.count)
    out_path = args.output.resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, separators=(",", ":")) + "\n")

    print(f"[+] Successfully generated {len(records)} authenticated records.")
    print(f"[+] Evidence file: {out_path}")
    print(f"[+] Key Identifier: {args.key_id}")
    print("[*] Note: These records are SIMULATED for demonstration purposes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
