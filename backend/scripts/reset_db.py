#!/usr/bin/env python3
"""
LABGUARD Development Database Reset Utility
Safely resets the local SQLite database to a pristine zero-baseline state.

Safety Guarantees:
1. Always creates a timestamped backup before performing any deletion.
2. Preserves secret keys (LABGUARD/keys/labguard_keys.json and firmware secrets).
3. Preserves configuration and authentication credentials (telemetry.lead@labguard.io).
4. Clears historical test telemetry, sessions, and verification jobs.
5. Idempotent and safe to run multiple times.
"""

import os
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.core.config import settings
from backend.app.core.security import hash_password

def reset_database() -> bool:
    print("=" * 70)
    print(" LABGUARD DEVELOPMENT DATABASE RESET")
    print("=" * 70)

    # 1. Resolve database path
    db_url = settings.DATABASE_URL
    if db_url.startswith("sqlite:///"):
        rel_path = db_url.replace("sqlite:///", "")
        db_path = PROJECT_ROOT / rel_path
    else:
        db_path = PROJECT_ROOT / "backend" / "data" / "labguard.db"

    print(f"[*] Target Database File: {db_path}")

    if not db_path.exists():
        print(f"[!] Database file does not exist at {db_path}. Initializing empty schema...")
        from backend.app.database import init_db
        init_db()
        print("[+] Initialized fresh database.")
        return True

    # 2. Create timestamped backup
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = db_path.parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / f"labguard_backup_{timestamp}.db"

    print(f"[*] Creating safe pre-reset backup at:")
    print(f"    -> {backup_path}")
    shutil.copy2(db_path, backup_path)
    print(f"[+] Backup successfully created ({backup_path.stat().st_size} bytes).")

    # 3. Connect and count pre-reset rows
    con = sqlite3.connect(str(db_path))
    cur = con.cursor()

    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [r[0] for r in cur.fetchall() if not r[0].startswith("sqlite_")]

    print("\n[*] Pre-Reset Table Row Counts:")
    pre_counts = {}
    for tbl in tables:
        count = cur.execute(f"SELECT COUNT(*) FROM {tbl};").fetchone()[0]
        pre_counts[tbl] = count
        print(f"    - {tbl:<22}: {count:>6} rows")

    # 4. Perform controlled truncate of test data
    print("\n[*] Clearing historical records, sessions, and verification jobs...")
    
    # Tables to clear
    tables_to_clear = [
        "telemetry_records",
        "recording_sessions",
        "verification_jobs",
        "user_sessions",
    ]

    for tbl in tables_to_clear:
        if tbl in tables:
            cur.execute(f"DELETE FROM {tbl};")
            print(f"    [x] Cleared {tbl}")

    # 5. Ensure default admin user exists
    admin_email = "telemetry.lead@labguard.io"
    admin_exists = cur.execute("SELECT COUNT(*) FROM users WHERE email = ?;", (admin_email,)).fetchone()[0]
    
    if admin_exists == 0:
        print(f"\n[*] Bootstrapping default operator account '{admin_email}'...")
        hashed_pw = hash_password("lg_demo_key_2026")
        cur.execute(
            """
            INSERT INTO users (email, hashed_password, role, facility)
            VALUES (?, ?, ?, ?);
            """,
            (admin_email, hashed_pw, "Hardware Telemetry Engineer", "Chamber Alpha-7 (ESP32 Gateway)")
        )
        print(f"    [+] Created operator account '{admin_email}'.")
    else:
        print(f"\n[+] Retained existing operator account '{admin_email}'.")

    # 6. Commit and VACUUM
    con.commit()
    print("\n[*] Optimizing SQLite database (VACUUM & integrity check)...")
    cur.execute("VACUUM;")
    integrity = cur.execute("PRAGMA integrity_check;").fetchone()[0]
    print(f"[+] SQLite PRAGMA integrity_check: {integrity}")

    # 7. Post-Reset Table Row Counts
    print("\n[*] Post-Reset Zero-Baseline State:")
    post_counts = {}
    for tbl in tables:
        count = cur.execute(f"SELECT COUNT(*) FROM {tbl};").fetchone()[0]
        post_counts[tbl] = count
        print(f"    - {tbl:<22}: {count:>6} rows")

    con.close()

    print("\n" + "=" * 70)
    print(" RESET COMPLETE: Baseline is now 0 records, 0 sessions, 0 anomalies.")
    print(f" Backup preserved at: {backup_path}")
    print("=" * 70)
    return True

if __name__ == "__main__":
    success = reset_database()
    sys.exit(0 if success else 1)
