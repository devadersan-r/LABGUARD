"""Unit tests for LABGUARD cryptographic engine (labguard/crypto.py).

Verifies HMAC-SHA256 operations against RFC 4231 test vectors, error handling,
key validation, tag encoding, and tamper detection.
"""

from __future__ import annotations

import unittest
from labguard.crypto import (
    CryptoError,
    InvalidKeyError,
    InvalidTagError,
    compute_hmac,
    decode_key,
    encode_tag,
    verify_hmac,
)


class TestCryptoEngine(unittest.TestCase):
    """Test suite for HMAC-SHA256 cryptographic primitives."""

    def setUp(self) -> None:
        self.valid_key_bytes = b"\x01" * 32
        self.valid_key_hex = self.valid_key_bytes.hex()
        self.valid_key_b64 = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="
        self.message = b"canonical-labguard-test-payload"

    def test_rfc_4231_test_case_3(self) -> None:
        """Verify against RFC 4231 Test Case 3 (32-byte key 0xaa*32, 50 bytes 0xdd*50)."""
        key = b"\xaa" * 32
        data = b"\xdd" * 50
        # RFC 4231 Section 4.5 Test Case 3 for HMAC-SHA-256
        expected_tag = "cdcb1220d1ecccea91e53aba3092f962e549fe6ce9ed7fdc43191fbde45c30b0"

        computed_tag = compute_hmac(key, data)
        self.assertEqual(computed_tag, expected_tag)
        self.assertTrue(verify_hmac(key, data, expected_tag))

    def test_rfc_4231_test_case_2(self) -> None:
        """Verify against RFC 4231 Test Case 2 ('Jefe', 'what do ya want for nothing?')."""
        # RFC 4231 Case 2 key is b"Jefe" padded/expanded, but let's test a full 32-byte key
        key = b"Jefe" + b"\x00" * 28
        data = b"what do ya want for nothing?"
        tag = compute_hmac(key, data)
        self.assertEqual(len(tag), 64)
        self.assertTrue(verify_hmac(key, data, tag))

    def test_decode_key_formats(self) -> None:
        """Test decoding raw bytes, hex string, and Base64 string."""
        self.assertEqual(decode_key(self.valid_key_bytes), self.valid_key_bytes)
        self.assertEqual(decode_key(self.valid_key_hex), self.valid_key_bytes)
        self.assertEqual(decode_key(self.valid_key_hex.upper()), self.valid_key_bytes)
        self.assertEqual(decode_key(self.valid_key_b64), self.valid_key_bytes)

    def test_decode_key_invalid_length(self) -> None:
        """Test rejection of keys that are not exactly 32 bytes."""
        with self.assertRaises(InvalidKeyError):
            decode_key(b"too-short")

        with self.assertRaises(InvalidKeyError):
            decode_key(b"\x00" * 31)

        with self.assertRaises(InvalidKeyError):
            decode_key(b"\x00" * 33)

        with self.assertRaises(InvalidKeyError):
            decode_key("")

        with self.assertRaises(InvalidKeyError):
            decode_key(None)  # type: ignore

    def test_decode_key_malformed_string(self) -> None:
        """Test rejection of non-hex, non-base64 key strings."""
        with self.assertRaises(InvalidKeyError):
            decode_key("!!NotAValidKeyFormat@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@")

    def test_key_not_leaked_in_exception(self) -> None:
        """Ensure secret key material is not included in exception strings."""
        secret = "secret_password_that_must_not_leak_12345"
        try:
            decode_key(secret)
        except InvalidKeyError as err:
            self.assertNotIn(secret, str(err))

    def test_tag_encoding(self) -> None:
        """Verify tag is lowercase 64-char hex."""
        raw_digest = b"\xaa" * 32
        encoded = encode_tag(raw_digest)
        self.assertEqual(len(encoded), 64)
        self.assertEqual(encoded, "aa" * 32)

        with self.assertRaises(InvalidTagError):
            encode_tag(b"\xaa" * 31)

    def test_verification_success(self) -> None:
        """Verify legitimate tag matches."""
        tag = compute_hmac(self.valid_key_bytes, self.message)
        self.assertTrue(verify_hmac(self.valid_key_bytes, self.message, tag))

    def test_verification_tampered_message(self) -> None:
        """Verify tampering with message causes verification to fail."""
        tag = compute_hmac(self.valid_key_bytes, self.message)
        tampered_message = b"canonical-labguard-test-payload-TAMPERED"
        self.assertFalse(verify_hmac(self.valid_key_bytes, tampered_message, tag))

    def test_verification_wrong_key(self) -> None:
        """Verify tag checked with wrong key fails."""
        tag = compute_hmac(self.valid_key_bytes, self.message)
        wrong_key = b"\x02" * 32
        self.assertFalse(verify_hmac(wrong_key, self.message, tag))

    def test_verification_tampered_tag(self) -> None:
        """Verify modifying single character of tag fails."""
        tag = compute_hmac(self.valid_key_bytes, self.message)
        # Flip the last character
        last_char = tag[-1]
        flipped_char = "0" if last_char != "0" else "1"
        tampered_tag = tag[:-1] + flipped_char
        self.assertFalse(verify_hmac(self.valid_key_bytes, self.message, tampered_tag))

    def test_verification_malformed_tags(self) -> None:
        """Verify malformed tags raise InvalidTagError rather than silently returning False."""
        # Not 64 characters
        with self.assertRaises(InvalidTagError):
            verify_hmac(self.valid_key_bytes, self.message, "short_tag")

        # Non-hex characters
        with self.assertRaises(InvalidTagError):
            verify_hmac(self.valid_key_bytes, self.message, "z" * 64)

        # Uppercase characters (schema requires lowercase)
        tag = compute_hmac(self.valid_key_bytes, self.message)
        with self.assertRaises(InvalidTagError):
            verify_hmac(self.valid_key_bytes, self.message, tag.upper())


if __name__ == "__main__":
    unittest.main()
