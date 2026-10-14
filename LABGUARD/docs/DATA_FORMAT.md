# LABGUARD Evidence Record & Canonical Serialization Specification

## 1. Specification Overview
To achieve independent, deterministic cryptographic verification between the ESP32 microcontroller firmware and the Python verification engine, LABGUARD enforces a strict, shared byte-level specification for all measurement records.

- **Wire Format**: JSONL (JSON Lines — RFC 7464), UTF-8 encoded without BOM. Exactly one complete record per line followed by `\n`.
- **Cryptographic Primitive**: HMAC-SHA256 (RFC 2104 / RFC 4231).
- **Authentication Scope**: Canonical UTF-8 bytes of all measurement payload fields. The outer `auth` object is excluded from the authenticated message.

---

## 2. Wire Record Schema (`labguard-v1`)

```json
{
  "schema": "labguard-v1",
  "session_id": "SESSION-2026-001",
  "device_id": "ESP32-DEV-01",
  "seq": 1,
  "elapsed_ms": 2000,
  "source": "DS18B20",
  "value_centi_c": 2850,
  "unit": "C",
  "auth": {
    "algorithm": "HMAC-SHA256",
    "key_id": "KEY-001",
    "tag": "6a2a0011d6cdca2c060ad20d79970c1f4f035c411a8d119c4844418ec6761f1b"
  }
}
```

### Field Definitions

| Field | Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `schema` | String | Fixed: `"labguard-v1"` | Schema version identifier |
| `session_id` | String | Regex: `^[A-Za-z0-9_\-\.]{1,64}$` | Laboratory session identifier |
| `device_id` | String | Regex: `^[A-Za-z0-9_\-\.]{1,64}$` | Physical sensor node identifier |
| `seq` | Integer | Positive integer (`seq > 0`) | Monotonically increasing sequence number |
| `elapsed_ms` | Integer | Non-negative integer (`>= 0`) | Monotonic milliseconds since session start |
| `source` | String | Non-empty string (e.g., `"DS18B20"`) | Hardware sensor source |
| `value_centi_c` | Integer | Finite signed integer | Temperature in hundredths of °C (e.g. `2850` = `28.50 °C`) |
| `unit` | String | Fixed: `"C"` | Temperature unit |
| `auth.algorithm` | String | Fixed: `"HMAC-SHA256"` | Cryptographic authentication primitive |
| `auth.key_id` | String | Regex: `^[A-Za-z0-9_\-\.]{1,32}$` | Non-secret key identifier |
| `auth.tag` | String | Regex: `^[0-9a-f]{64}$` | 64-character lowercase hexadecimal HMAC tag |

---

## 3. Deterministic Canonical Byte Serialization

Before computing or verifying the HMAC tag, both the ESP32 firmware and the Python verifier construct the canonical payload bytes:

1. **Excluded Fields**: The `auth` object is omitted.
2. **Fixed Field Sequence**:
   `schema` → `session_id` → `device_id` → `seq` → `elapsed_ms` → `source` → `value_centi_c` → `unit`
3. **No Whitespace**: JSON object separators are strictly `,` and `:` (no spaces).
4. **Integer Precision**: Standard base-10 digits without leading zeros. Floating-point numbers are prohibited to eliminate cross-platform float formatting discrepancies.
5. **Character Encoding**: UTF-8 without BOM.

### Canonical Template String
```text
{"schema":"%s","session_id":"%s","device_id":"%s","seq":%lu,"elapsed_ms":%lu,"source":"%s","value_centi_c":%ld,"unit":"%s"}
```

---

## 4. Shared Test Vectors

A dedicated deterministic public test key (`SHARED_TEST_KEY_HEX`) is used across unit tests to guarantee byte-level parity between Python and C++:

**Test Key**: `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20`

### Test Vector 1 (28.50 °C)
- **Record**: `{"schema":"labguard-v1","session_id":"SESSION-TEST-001","device_id":"DEVICE-01","seq":1,"elapsed_ms":1000,"source":"DS18B20","value_centi_c":2850,"unit":"C"}`
- **Canonical Bytes**: `b'{"schema":"labguard-v1","session_id":"SESSION-TEST-001","device_id":"DEVICE-01","seq":1,"elapsed_ms":1000,"source":"DS18B20","value_centi_c":2850,"unit":"C"}'`
- **Expected HMAC**: `6a2a0011d6cdca2c060ad20d79970c1f4f035c411a8d119c4844418ec6761f1b`

### Test Vector 2 (-5.25 °C)
- **Record**: `{"schema":"labguard-v1","session_id":"SESSION-TEST-001","device_id":"DEVICE-01","seq":2,"elapsed_ms":2000,"source":"DS18B20","value_centi_c":-525,"unit":"C"}`
- **Canonical Bytes**: `b'{"schema":"labguard-v1","session_id":"SESSION-TEST-001","device_id":"DEVICE-01","seq":2,"elapsed_ms":2000,"source":"DS18B20","value_centi_c":-525,"unit":"C"}'`
- **Expected HMAC**: `0881a3ce639eee2f47519e7f4129cab4bac66e7d5ebae81a738bfa948f63ce21`
