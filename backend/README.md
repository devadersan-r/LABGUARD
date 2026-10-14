# LabGuard — Local Hardware-Integrated Backend

## 1. Overview
LabGuard is a local, offline evidence-authentication and telemetry monitoring system built for laboratory cybersecurity verification. It collects sensor measurements from an ESP32 microcontroller over USB Serial, performs deterministic cryptographic verification using HMAC-SHA256 against canonical byte serialization, persists tamper-evident records in a local SQLite database, and serves a FastAPI REST interface to the React frontend.

## 2. Zero-Cloud Local Architecture
```
ESP32 DevKit (GPIO 4 DS18B20)
       ↓ (USB Serial @ 115200 baud)
Windows COM Port (e.g. COM3 / COM4)
       ↓
Python Serial Background Worker (PySerial)
       ↓
Cryptographic Engine (labguard HMAC-SHA256 Verifier)
       ↓
Local Persistence (SQLite in WAL Mode)
       ↓
FastAPI Local Backend (http://127.0.0.1:8000)
       ↓
React + Vite Frontend (http://localhost:5173)
```

No external cloud services, remote telemetry brokers, or third-party auth services are used.

## 3. Technology Stack
- **Language**: Python 3.10+
- **Framework**: FastAPI + Uvicorn
- **Cryptographic Engine**: HMAC-SHA256 (RFC 2104 / RFC 4231) via `hashlib` & `secrets` (constant-time comparison)
- **Local Persistence**: SQLite with WAL mode (`PRAGMA journal_mode=WAL`) & SQLAlchemy 2.0
- **Serial Interface**: PySerial with background worker thread and auto-reconnect
- **Operator Authentication**: Argon2id password hashing + cryptographically random local session tokens
- **Testing**: Pytest automated suite

## 4. Setup & Running on Windows

### A. Backend Installation & Startup
```powershell
# 1. From workspace root, ensure backend dependencies are installed:
python -m pip install -r backend/requirements.txt

# 2. Run the backend development server:
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

The interactive OpenAPI documentation is immediately accessible at:
- **Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### B. Frontend Startup
```powershell
# From workspace root:
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

## 5. Automated Testing
Run both the backend API test suite and the core authenticator test suite:
```powershell
# Run backend test suite (11 tests):
python -m pytest backend/tests/test_backend.py

# Run core authenticator test suite (41 tests):
python -m pytest LABGUARD/tests
```
All 52 tests execute and pass offline.

## 6. Hardware Connection & Troubleshooting
1. Connect the ESP32 via USB cable.
2. Open Windows **Device Manager** (`devmgmt.msc`) and expand **Ports (COM & LPT)**. Note the COM port number (e.g. `COM3` or `COM5`).
3. In the LabGuard dashboard or via `POST /api/serial/connect`, select the port at **115200 baud**.
4. If the ESP32 is not currently plugged in, activate the **Bench Simulator Mode** in the dashboard or via `POST /api/serial/simulator` to stream authentic canonical `labguard-v1` demonstration packets signed with `KEY-001`.
