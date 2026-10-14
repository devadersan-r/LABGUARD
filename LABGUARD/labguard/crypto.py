"""Cryptographic engine for LABGUARD evidence authentication.

Implements HMAC-SHA256 authentication and verification conforming to Section 6
of the LABGUARD specification.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import re
from typing import Union

# HMAC-SHA256 requires a 256-bit (32-byte) key for standard security
EXPECTED_KEY_LENGTH_BYTES = 32
EXPECTED_TAG_HEX_LENGTH = 64
HEX_TAG_REGEX = re.compile(r"^[0-9a-f]{64}$")


class CryptoError(Exception):
    """Base exception for all cryptographic errors in LABGUARD."""
    pass


class InvalidKeyError(CryptoError):
    """Raised when a cryptographic key is invalid, malformed, or wrong length."""
    pass


class InvalidTagError(CryptoError):
    """Raised when an authentication tag is malformed."""
    pass


def decode_key(encoded_key: Union[str, bytes]) -> bytes:
    """Decode and validate a 32-byte (256-bit) secret key.

    Supports:
        - Raw bytes of length 32
        - 64-character hexadecimal string
        - 44-character Base64 string (representing 32 bytes)

    Args:
        encoded_key: Secret key as raw bytes, hex string, or base64 string.

    Returns:
        32 bytes representing the raw secret key.

    Raises:
        InvalidKeyError: If key cannot be decoded or is not exactly 32 bytes.
        Note: Secret key content is NEVER included in error messages.
    """
    if encoded_key is None:
        raise InvalidKeyError("Key cannot be None")

    raw_bytes: bytes

    if isinstance(encoded_key, bytes):
        raw_bytes = encoded_key
    elif isinstance(encoded_key, str):
        cleaned = encoded_key.strip()
        if not cleaned:
            raise InvalidKeyError("Key string cannot be empty")

        # Try hexadecimal (64 characters)
        if len(cleaned) == 64 and all(c in "0123456789abcdefABCDEF" for c in cleaned):
            try:
                raw_bytes = bytes.fromhex(cleaned)
            except ValueError as err:
                raise InvalidKeyError(f"Failed to parse hexadecimal key: {err}") from err
        else:
            # Try Base64
            try:
                raw_bytes = base64.b64decode(cleaned, validate=True)
            except (binascii.Error, ValueError) as err:
                raise InvalidKeyError(
                    "Invalid key format: key must be a 64-character hex string "
                    "or a valid 32-byte Base64 string"
                ) from err
    else:
        raise InvalidKeyError(f"Unsupported key type: {type(encoded_key).__name__}")

    if len(raw_bytes) != EXPECTED_KEY_LENGTH_BYTES:
        raise InvalidKeyError(
            f"Invalid key length: expected {EXPECTED_KEY_LENGTH_BYTES} bytes, "
            f"got {len(raw_bytes)} bytes"
        )

    return raw_bytes


def encode_tag(tag_bytes: bytes) -> str:
    """Encode raw 32-byte HMAC digest as 64 lowercase hexadecimal characters.

    Args:
        tag_bytes: 32 raw bytes from HMAC-SHA256 digest.

    Returns:
        64-character lowercase hex string.

    Raises:
        InvalidTagError: If input is not exactly 32 bytes.
    """
    if not isinstance(tag_bytes, (bytes, bytearray)):
        raise InvalidTagError("Tag input must be bytes")
    if len(tag_bytes) != 32:
        raise InvalidTagError(f"Expected 32-byte tag, got {len(tag_bytes)} bytes")
    return tag_bytes.hex().lower()


def compute_hmac(key: Union[str, bytes], message: bytes) -> str:
    """Compute HMAC-SHA256 authentication tag over message bytes.

    Args:
        key: Raw 32-byte key or hex/base64 encoded key string.
        message: Canonical message bytes to authenticate.

    Returns:
        64-character lowercase hexadecimal HMAC-SHA256 tag.

    Raises:
        InvalidKeyError: If key is invalid or not 32 bytes.
        CryptoError: If message is not bytes.
    """
    key_bytes = decode_key(key)

    if not isinstance(message, (bytes, bytearray)):
        raise CryptoError(f"Message must be bytes, got {type(message).__name__}")

    raw_digest = hmac.new(key_bytes, message, hashlib.sha256).digest()
    return encode_tag(raw_digest)


def verify_hmac(
    key: Union[str, bytes],
    message: bytes,
    supplied_tag: str,
) -> bool:
    """Independently verify HMAC-SHA256 authentication tag.

    Uses constant-time comparison (hmac.compare_digest) to prevent timing attacks.

    Args:
        key: Raw 32-byte key or hex/base64 encoded key string.
        message: Canonical message bytes that were authenticated.
        supplied_tag: The 64-character lowercase hexadecimal tag to verify.

    Returns:
        True if the supplied tag matches the computed HMAC tag; False otherwise.

    Raises:
        InvalidKeyError: If key is invalid or not 32 bytes.
        InvalidTagError: If supplied tag is malformed (not 64 lowercase hex chars).
        CryptoError: If message is not bytes.
    """
    key_bytes = decode_key(key)

    if not isinstance(supplied_tag, str):
        raise InvalidTagError(f"Supplied tag must be a string, got {type(supplied_tag).__name__}")

    # Enforce strict 64-character lowercase hexadecimal format
    if not HEX_TAG_REGEX.match(supplied_tag):
        raise InvalidTagError(
            "Supplied tag is malformed: must be exactly 64 lowercase hexadecimal characters"
        )

    expected_tag = compute_hmac(key_bytes, message)

    # hmac.compare_digest provides constant-time comparison against timing side-channels
    return hmac.compare_digest(expected_tag, supplied_tag)
