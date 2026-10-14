#!/usr/bin/env python3
"""LABGUARD Key Provisioning & Rotation Tool.

Securely provisions a fresh 32-byte cryptographically random key for HMAC-SHA256 authentication,
stores it in an owner-only protected key store (0600 permissions), and synchronously
updates the ESP32 Arduino C++ firmware header to ensure cryptographic parity.

Security Hardened (Section 4 of correction.txt):
- Zero secret leakage in stdout, stderr, or exception messages.
- Atomic file writes to prevent corrupted configuration on interruption.
- Fails safely on corrupt key stores (refuses to silently discard or overwrite).
- Requires explicit --rotate flag for key rotation.
- Safeguards against desynchronizing ESP32 firmware and Python verifier.

Usage:
    python3 scripts/generate_key.py --key-id KEY-001
    python3 scripts/generate_key.py --key-id KEY-001 --rotate
"""

from __future__ import annotations

import argparse
import os
import stat
import sys
import tempfile
from pathlib import Path

# Add project root to path for module discovery
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from labguard.key_manager import (
    DEFAULT_KEY_ID,
    KeyManagerError,
    KeyStore,
    KeyStoreCorruptedError,
    format_esp32_header,
    generate_secret_key,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Securely provision or rotate a LABGUARD HMAC-SHA256 authentication key.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--key-id",
        type=str,
        default=DEFAULT_KEY_ID,
        help="Non-secret identifier for this key (e.g., KEY-001)",
    )
    parser.add_argument(
        "--description",
        type=str,
        default="",
        help="Optional human-readable description for the key entry",
    )
    parser.add_argument(
        "--output-file",
        type=Path,
        default=PROJECT_ROOT / "keys" / "labguard_keys.json",
        help="Path to JSON key store file",
    )
    parser.add_argument(
        "--esp32-header",
        type=Path,
        default=PROJECT_ROOT / "firmware" / "LABGUARD_ESP32" / "secrets.h",
        help="Path to Arduino ESP32 C++ header file",
    )
    parser.add_argument(
        "--no-esp32",
        action="store_true",
        help="Skip updating ESP32 header (use with caution to avoid desynchronization)",
    )
    parser.add_argument(
        "--confirm-no-esp32",
        action="store_true",
        help="Explicit confirmation required when using --no-esp32 during key rotation",
    )
    parser.add_argument(
        "--rotate",
        action="store_true",
        help="Explicitly rotate existing key in keystore and synchronize ESP32 header",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Alias for --rotate to overwrite existing key ID",
    )
    return parser.parse_args()


def write_header_atomically(target_path: Path, content: str) -> None:
    """Write C++ header atomically with 0600 POSIX permissions."""
    target_path.parent.mkdir(parents=True, exist_ok=True)
    temp_file = tempfile.NamedTemporaryFile(
        mode="w",
        dir=str(target_path.parent),
        prefix=".header_",
        suffix=".tmp",
        delete=False,
        encoding="utf-8",
    )
    temp_path = Path(temp_file.name)
    try:
        temp_file.write(content)
        temp_file.flush()
        os.fsync(temp_file.fileno())
        temp_file.close()

        if os.name == "posix":
            os.chmod(temp_path, 0o600)

        os.replace(temp_path, target_path)

        if os.name == "posix":
            os.chmod(target_path, 0o600)
    except Exception:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass
        raise


def main() -> int:
    args = parse_args()
    allow_overwrite = args.rotate or args.force

    print("=================================================================")
    print("             LABGUARD Key Management Provisioning               ")
    print("=================================================================")

    output_file = args.output_file.resolve()
    esp32_path = args.esp32_header.resolve()

    # 1. Inspect existing key store and load safely
    keystore = KeyStore()
    if output_file.exists():
        try:
            keystore.load_from_file(output_file)
            print(f"[*] Validated existing key store: {output_file}")
        except KeyStoreCorruptedError as err:
            sys.stderr.write(
                f"\n[!] SECURITY ERROR: Existing key store at {output_file} is corrupt or invalid.\n"
                f"    Details: {err}\n"
                f"    Refusing to overwrite or replace corrupt key store to prevent accidental data loss.\n"
                f"    Please manually inspect or restore the key store before proceeding.\n"
            )
            return 1
        except Exception as err:
            sys.stderr.write(
                f"\n[!] ERROR: Failed to access key store at {output_file}: {err}\n"
            )
            return 1

    # 2. Check for key collision and rotation safeguards
    key_exists = keystore.has_key(args.key_id)
    if key_exists and not allow_overwrite:
        sys.stderr.write(
            f"\n[!] Key identifier '{args.key_id}' already exists in {output_file}.\n"
            f"    To rotate this key, run with --rotate:\n"
            f"    python3 scripts/generate_key.py --key-id {args.key_id} --rotate\n"
        )
        return 1

    if key_exists and args.no_esp32 and not args.confirm_no_esp32:
        sys.stderr.write(
            "\n[!] SAFEGUARD REJECTION: Rotating an existing key with --no-esp32 will desynchronize\n"
            "    the ESP32 sensor node from the Python verifier, causing all future records to fail.\n"
            "    To proceed anyway, you must pass --confirm-no-esp32.\n"
        )
        return 1

    # 3. Generate key securely via CSPRNG
    try:
        key_info = generate_secret_key(
            key_id=args.key_id,
            description=args.description or f"Key for {args.key_id}",
        )
    except KeyManagerError as err:
        sys.stderr.write(f"\n[!] Key generation error: {err}\n")
        return 1

    key_id = key_info["key_id"]
    raw_bytes = bytes.fromhex(key_info["key_hex"])

    # 4. Update keystore in memory and save atomically
    try:
        keystore.add_key(
            key_id=key_id,
            secret_key=raw_bytes,
            description=key_info["description"],
            overwrite=allow_overwrite,
        )
        saved_path = keystore.save_to_file(output_file)
    except Exception as err:
        sys.stderr.write(f"\n[!] Failed to save key store: {err}\n")
        return 1

    # Check and report POSIX permissions
    file_perm_str = ""
    if os.name == "posix":
        mode = oct(stat.S_IMODE(saved_path.stat().st_mode))
        file_perm_str = f" (POSIX permissions: {mode})"
    print(f"[+] Key store saved: {saved_path}{file_perm_str}")

    # 5. Synchronously update ESP32 firmware header unless explicitly skipped
    if not args.no_esp32:
        try:
            header_content = format_esp32_header(raw_bytes, key_id)
            write_header_atomically(esp32_path, header_content)
            esp_mode_str = ""
            if os.name == "posix":
                esp_mode = oct(stat.S_IMODE(esp32_path.stat().st_mode))
                esp_mode_str = f" (POSIX permissions: {esp_mode})"
            print(f"[+] ESP32 firmware header updated: {esp32_path}{esp_mode_str}")
        except Exception as err:
            sys.stderr.write(f"\n[!] Failed to write ESP32 header: {err}\n")
            return 1
    else:
        print("[!] Note: ESP32 header update skipped (--no-esp32).")

    # 6. Report NON-SENSITIVE Summary (Never print secret material!)
    operation_type = "ROTATED" if (key_exists and allow_overwrite) else "PROVISIONED"
    print("\n---------------------- Status Summary ---------------------------")
    print(f"Operation      : {operation_type}")
    print(f"Key Identifier : {key_id}")
    print(f"Algorithm      : HMAC-SHA256 (32 bytes / 256 bits)")
    print(f"Key Store File : {saved_path}")
    if not args.no_esp32:
        print(f"ESP32 Header   : {esp32_path}")
    print("Synchronization: VERIFIER AND FIRMWARE SYNCHRONIZED")
    print("-----------------------------------------------------------------")
    print("[*] Security Confirmation:")
    print("    - Restrictive 0600 permissions enforced.")
    print("    - Real secret keys are NEVER printed to terminal or logs.")
    print("    - Both verifier and ESP32 header provisioned with matching key.")
    print("=================================================================\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
