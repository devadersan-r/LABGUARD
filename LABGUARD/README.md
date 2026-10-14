# LABGUARD — Offline Laboratory Evidence Integrity System

LABGUARD is a low-cost, offline-first, independently verifiable cryptographic integrity system for laboratory measurements captured by an ESP32 microcontroller and a DS18B20 temperature sensor.

---

## 1. Architecture and Data Flow

```text
+-----------------------+
| DS18B20 Temp Sensor   |
+-----------+-----------+
            | (OneWire / GPIO 4)
+-----------v-----------+
| ESP32 Microcontroller |
| - Read temp (°C)      |
| - Format centi-°C     |
| - Canonicalize bytes  |
| - Compute HMAC-SHA256 |
+-----------+-----------+
            | (USB Serial / JSONL)
+-----------v-----------+
| Workstation / Storage |
| - evidence/*.jsonl    |
+-----------+-----------+
            |
+-----------v-----------+
| Independent Verifier  |
| (labguard.verifier)   |
| - Reconstruct payload |
| - Constant-time HMAC  |
| - Sequence checks     |
+-----------------------+
```

1. **Measurement**: DS18B20 measures temperature; ESP32 reads value and converts to integer `value_centi_c` (hundredths of a degree Celsius).
2. **Canonicalization**: ESP32 constructs deterministic UTF-8 payload bytes following `labguard-v1`.
3. **Authentication**: ESP32 computes an HMAC-SHA256 tag using a provisioned 32-byte secret key.
4. **Export**: Complete JSONL record is transmitted over USB Serial and saved to a local evidence file.
5. **Independent Verification**: The workstation reads the JSONL evidence file without network access, reconstructs canonical bytes, verifies tags using `hmac.compare_digest`, and checks sequence continuity.

---

## 2. Directory Structure

```text
LABGUARD/
├── .gitignore                    # Excludes real keys and firmware secrets
├── authenticator.txt             # Original project specification
├── correction.txt                # Hardening & security review specification
├── README.md                     # Project overview and instructions
├── docs/
│   ├── DATA_FORMAT.md            # Canonical byte specification & test vectors
│   └── KEY_MANAGEMENT.md         # Key management, rotation & threat model
├── firmware/
│   └── LABGUARD_ESP32/
│       ├── LABGUARD_ESP32.ino    # ESP32 Arduino sketch (DS18B20 + mbedtls HMAC)
│       ├── secrets.h             # Generated local secret key (0600, gitignored)
│       └── secrets.h.example     # Safe dummy template for version control
├── keys/
│   ├── labguard_keys.json        # Generated local key store (0600, gitignored)
│   └── keys.example.json         # Safe dummy template for version control
├── labguard/
│   ├── __init__.py
│   ├── canonical.py              # Canonical byte serializer & test vectors
│   ├── crypto.py                 # Constant-time HMAC-SHA256 cryptographic engine
│   ├── key_manager.py            # KeyStore, atomic writes & permission enforcement
│   ├── schema.py                 # JSONL parser & duplicate key rejection
│   └── verifier.py               # Independent Python verification engine
├── scripts/
│   ├── generate_key.py           # Hardened key provisioning & rotation CLI
│   ├── create_demo_evidence.py   # Simulated JSONL evidence generator
│   └── tamper_demo.py            # End-to-end original vs. tampered demonstration
└── tests/
    ├── __init__.py
    ├── test_canonical.py         # Byte-level serialization & test vector tests
    ├── test_crypto.py            # RFC 4231 HMAC-SHA256 & key validation tests
    ├── test_key_manager.py       # Hardened KeyStore, atomic writes & fail-closed tests
    ├── test_schema.py            # Schema constraints & duplicate JSON key tests
    └── test_verifier.py          # Independent verification & sequence anomaly tests
```

---

## 3. Quickstart & Workflow

### A. Environment Setup
LABGUARD uses the Python 3 standard library (`hashlib`, `hmac`, `secrets`, `json`, `os`, `sys`). No external pip dependencies are required for the core verification engine.

```bash
python3 --version  # Requires Python 3.8+
```

### B. Provision or Rotate Authentication Keys
To provision an initial 32-byte key:
```bash
python3 scripts/generate_key.py --key-id KEY-001
```
To rotate a compromised or expired key safely (synchronously updating keystore and firmware header):
```bash
python3 scripts/generate_key.py --key-id KEY-001 --rotate
```
*Note: The CLI tool enforces 0600 permissions and never leaks secret key values to the terminal.*

### C. Run the Automated Test Suite
Execute the full test suite (41 tests covering RFC 4231 test vectors, fail-closed key resolution, and tamper detection):
```bash
python3 -m unittest discover -s tests -v
```

### D. Run the End-to-End Tamper Detection Demonstration
```bash
python3 scripts/tamper_demo.py
```
This demonstrates:
1. Verification of untouched evidence (`VALID`).
2. Detection of modified temperature values without valid HMAC tags (`INVALID`).
3. Rejection of unknown key identifiers (`INCOMPLETE/UNVERIFIABLE`).

### E. Verify Evidence Files via CLI
```bash
python3 -m labguard.verifier evidence/demo_valid.jsonl
```

---

## 4. Verification Result Semantics

- **`VALID`**: All records passed HMAC-SHA256 authentication, schema validation, and sequence consistency.
- **`INVALID`**: One or more records failed HMAC verification (tampering detected), contained duplicate keys, or violated sequence integrity.
- **`INCOMPLETE/UNVERIFIABLE`**: One or more records referenced a key ID not present in the local key store, or the evidence file was empty.

---

## 5. Security Model & Explicit Limitations

- **Symmetric Authentication**: HMAC-SHA256 provides data integrity and proof that the record originated from a node with the shared key. It does *not* provide public-key non-repudiation.
- **Microcontroller Key Storage**: Storing keys in microcontroller flash memory is vulnerable to physical extraction (e.g., JTAG probing or direct flash dump). For production deployments, integrate an external secure element (such as ATECC608A) or enable ESP32 Flash Encryption + Secure Boot v2.
- **Zero Secret Exposure**: Secret keys are never printed in logs, verification outputs, or exception messages.
