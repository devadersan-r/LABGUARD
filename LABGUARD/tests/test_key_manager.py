"""Unit tests for hardened LABGUARD key management (labguard/key_manager.py).

Verifies key generation, atomic file storage, POSIX 0600 permissions,
fail-closed unknown key handling, rejection of generic fallback variables,
rejection of corrupt/malformed keystores, and zero secret leakage.

Conforms to Section 3 and Section 9 of correction.txt.
"""

from __future__ import annotations

import io
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from labguard.crypto import InvalidKeyError
from labguard.key_manager import (
    KeyManagerError,
    KeyNotFoundError,
    KeyStore,
    KeyStoreCorruptedError,
    UnsupportedAlgorithmError,
    format_esp32_header,
    generate_secret_key,
    validate_key_id,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class TestKeyManagerHardened(unittest.TestCase):
    """Test suite for hardened key management."""

    def test_key_id_validation(self) -> None:
        """Validate valid and invalid key identifiers."""
        self.assertEqual(validate_key_id("KEY-001"), "KEY-001")
        self.assertEqual(validate_key_id("DEVICE_01.A"), "DEVICE_01.A")

        with self.assertRaises(KeyManagerError):
            validate_key_id("")

        with self.assertRaises(KeyManagerError):
            validate_key_id("key with spaces")

        with self.assertRaises(KeyManagerError):
            validate_key_id("a" * 33)

    def test_generate_secret_key(self) -> None:
        """Verify generation of cryptographically secure random keys."""
        k1 = generate_secret_key("KEY-001")
        k2 = generate_secret_key("KEY-001")

        self.assertEqual(k1["key_id"], "KEY-001")
        self.assertEqual(k1["algorithm"], "HMAC-SHA256")
        self.assertEqual(k1["length_bytes"], 32)
        self.assertEqual(len(k1["key_hex"]), 64)
        self.assertEqual(len(k1["key_b64"]), 44)

        # Must have high entropy (distinct keys)
        self.assertNotEqual(k1["key_hex"], k2["key_hex"])

    def test_unknown_key_id_fails_closed(self) -> None:
        """Verify that an unknown key ID raises KeyNotFoundError and does not authenticate."""
        ks = KeyStore()
        ks.add_key("KEY-001", b"\x01" * 32)

        self.assertTrue(ks.has_key("KEY-001"))
        self.assertFalse(ks.has_key("KEY-UNKNOWN"))

        with self.assertRaises(KeyNotFoundError):
            ks.get_key("KEY-UNKNOWN")

    def test_generic_fallback_env_var_rejected(self) -> None:
        """Verify that generic LABGUARD_SECRET_KEY CANNOT authenticate an arbitrary key ID.

        Enforces the critical security fix from Section 3 of correction.txt.
        """
        ks = KeyStore()
        dummy_hex = "02" * 32

        with patch.dict(os.environ, {"LABGUARD_SECRET_KEY": dummy_hex}, clear=True):
            # Must NOT resolve an unknown key ID
            self.assertFalse(ks.has_key("KEY-UNREGISTERED"))
            with self.assertRaises(KeyNotFoundError):
                ks.get_key("KEY-UNREGISTERED")

    def test_key_specific_env_var_allowed(self) -> None:
        """Verify that explicit key-specific environment variable is accepted."""
        ks = KeyStore()
        dummy_hex = "03" * 32
        expected_bytes = bytes.fromhex(dummy_hex)

        with patch.dict(os.environ, {"LABGUARD_KEY_KEY_SPECIFIC": dummy_hex}, clear=True):
            self.assertTrue(ks.has_key("KEY-SPECIFIC"))
            self.assertEqual(ks.get_key("KEY-SPECIFIC"), expected_bytes)

    def test_atomic_file_persistence_and_permissions(self) -> None:
        """Verify atomic writes and 0600 POSIX permissions."""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "keys" / "test_keystore.json"
            ks1 = KeyStore()
            key_bytes = b"\x04" * 32
            ks1.add_key("KEY-001", key_bytes, description="Test key")
            saved = ks1.save_to_file(file_path)

            self.assertTrue(saved.exists())

            # Check POSIX permissions (0600)
            if os.name == "posix":
                mode = stat.S_IMODE(saved.stat().st_mode)
                self.assertEqual(mode, 0o600, f"Expected 0600, got {oct(mode)}")

            # Load into fresh keystore
            ks2 = KeyStore(saved)
            self.assertTrue(ks2.has_key("KEY-001"))
            self.assertEqual(ks2.get_key("KEY-001"), key_bytes)

    def test_corrupt_keystore_fails_safely_never_silently_replaced(self) -> None:
        """Verify that a malformed keystore raises KeyStoreCorruptedError and is preserved."""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "keys" / "corrupt_keystore.json"
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write('{"keys": "this-is-not-a-valid-dictionary}')

            ks = KeyStore()
            with self.assertRaises(KeyStoreCorruptedError):
                ks.load_from_file(file_path)

            # Ensure file content was not wiped or replaced
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertIn("not-a-valid-dictionary", content)

    def test_keystore_algorithm_mismatch_rejected(self) -> None:
        """Verify that an unsupported algorithm raises UnsupportedAlgorithmError."""
        ks = KeyStore()
        with self.assertRaises(UnsupportedAlgorithmError):
            ks.add_key("KEY-001", b"\x05" * 32, algorithm="MD5")

    def test_keystore_entry_key_id_mismatch_rejected(self) -> None:
        """Verify that mismatch between dict key and internal key_id raises KeyStoreCorruptedError."""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "keys" / "mismatched.json"
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write("""{
                    "keys": {
                        "KEY-001": {
                            "key_id": "KEY-DIFFERENT",
                            "algorithm": "HMAC-SHA256",
                            "key_hex": "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"
                        }
                    }
                }""")

            ks = KeyStore()
            with self.assertRaises(KeyStoreCorruptedError):
                ks.load_from_file(file_path)

    def test_cli_generator_zero_secret_leakage(self) -> None:
        """Ensure scripts/generate_key.py never prints secret key hex/b64 to stdout or stderr."""
        with tempfile.TemporaryDirectory() as tmpdir:
            key_path = Path(tmpdir) / "test_keys.json"
            esp_path = Path(tmpdir) / "test_secrets.h"

            cmd = [
                sys.executable,
                str(PROJECT_ROOT / "scripts" / "generate_key.py"),
                "--key-id",
                "KEY-TEST-CLI",
                "--output-file",
                str(key_path),
                "--esp32-header",
                str(esp_path),
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)

            # Retrieve actual key from generated file
            ks = KeyStore(key_path)
            real_key_bytes = ks.get_key("KEY-TEST-CLI")
            real_key_hex = real_key_bytes.hex().lower()

            # Confirm secret hex is NEVER in stdout or stderr
            self.assertNotIn(real_key_hex, result.stdout.lower())
            self.assertNotIn(real_key_hex, result.stderr.lower())
            self.assertNotIn("export labguard_key", result.stdout.lower())

    def test_format_esp32_header(self) -> None:
        """Test formatting C++ header for ESP32 DevKit."""
        key_bytes = bytes(range(32))
        header = format_esp32_header(key_bytes, "KEY-001")

        self.assertIn("#ifndef LABGUARD_SECRETS_H", header)
        self.assertIn('static const char* const LABGUARD_KEY_ID = "KEY-001";', header)
        self.assertIn("static const uint8_t LABGUARD_SECRET_KEY[32] = {", header)
        self.assertIn("0x00, 0x01, 0x02, 0x03", header)
        self.assertIn("flash memory is intended for", header)


if __name__ == "__main__":
    unittest.main()
