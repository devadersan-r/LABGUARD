import datetime
import email.message
import html
import logging
import smtplib
import ssl
import threading
import time
import uuid
from typing import Any, Dict, Optional, Tuple

from backend.app.core.config import settings
from backend.app.core.logging_config import logger

class EmailService:
    def __init__(self):
        self._lock = threading.RLock()
        self.total_alerts_sent: int = 0
        self.last_alert_time: Optional[str] = None
        self.last_alert_status: str = "IDLE"  # IDLE, SUCCESS, FAILED, COOLDOWN
        self.last_error_message: Optional[str] = None
        
        # Deduplication / Cooldown cache: maps key -> timestamp (epoch seconds)
        self._cooldown_tracker: Dict[str, float] = {}
        try:
            env_file = settings.BACKEND_DIR / ".env"
            self._last_env_mtime: float = env_file.stat().st_mtime if env_file.exists() else 0.0
        except Exception:
            self._last_env_mtime: float = 0.0

    def _refresh_config(self):
        """Ensure settings are reloaded from backend/.env so live configuration changes take effect immediately."""
        try:
            env_file = settings.BACKEND_DIR / ".env"
            if env_file.exists():
                mtime = env_file.stat().st_mtime
                if mtime > getattr(self, "_last_env_mtime", 0.0):
                    self._last_env_mtime = mtime
                    from backend.app.core.config import reload_settings
                    reload_settings()
        except Exception:
            pass

    def is_configured(self) -> bool:
        """Check whether SMTP is fully configured with a valid non-placeholder password."""
        self._refresh_config()
        from backend.app.core.config import settings
        pwd = settings.SMTP_PASSWORD.strip() if settings.SMTP_PASSWORD else ""
        if not pwd or pwd == "PASTE_MY_NEW_GMAIL_APP_PASSWORD_HERE":
            return False
        return bool(settings.SMTP_HOST and settings.SMTP_PORT and settings.SMTP_USERNAME and settings.TAMPER_ALERT_TO)

    def get_status(self) -> Dict[str, Any]:
        """Return safe, non-sensitive notification service status for dashboard and health inspection."""
        with self._lock:
            return {
                "configured": self.is_configured(),
                "provider": "Gmail SMTP",
                "host": settings.SMTP_HOST,
                "port": settings.SMTP_PORT,
                "fromEmail": settings.SMTP_FROM_EMAIL,
                "alertRecipient": settings.TAMPER_ALERT_TO,
                "tlsEnabled": settings.SMTP_USE_TLS,
                "totalAlertsSent": self.total_alerts_sent,
                "lastAlertTime": self.last_alert_time,
                "lastAlertStatus": self.last_alert_status,
                "lastErrorMessage": self.last_error_message,
                "cooldownSeconds": settings.ALERT_COOLDOWN_SECONDS,
            }

    def _sanitize_error(self, err: Exception) -> str:
        """Sanitize error messages to ensure passwords or sensitive strings are never leaked."""
        err_str = str(err)
        # Strip password if inadvertently present in error message
        if settings.SMTP_PASSWORD and settings.SMTP_PASSWORD in err_str:
            err_str = err_str.replace(settings.SMTP_PASSWORD, "[REDACTED]")
        return err_str

    def _create_smtp_connection(self) -> smtplib.SMTP:
        """Create a secure STARTTLS connection to Gmail SMTP with certificate validation."""
        context = ssl.create_default_context()
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12.0)
        server.ehlo()
        if settings.SMTP_USE_TLS:
            server.starttls(context=context)
            server.ehlo()
        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        return server

    def send_test_email(self, recipient: Optional[str] = None) -> Dict[str, Any]:
        """Send a dedicated operator test email. Does NOT trigger a tamper incident."""
        target_recipient = (recipient or settings.TAMPER_ALERT_TO).strip()
        now_dt = datetime.datetime.now()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")

        if not self.is_configured():
            msg = "SMTP credentials incomplete: Gmail App Password is not set in backend/.env"
            logger.warning(msg)
            return {
                "success": False,
                "message": msg,
                "recipient": target_recipient,
                "timestamp": now_str,
            }

        msg = email.message.EmailMessage()
        msg["Subject"] = "[LABGUARD] SMTP Verification Test Notification"
        msg["From"] = f"LABGUARD Security <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = target_recipient

        text_content = (
            f"LABGUARD TELEMETRY SECURITY MONITOR — SMTP TEST\n\n"
            f"This is an automated test message from the LABGUARD Integrity Engine.\n\n"
            f"Status: Gmail SMTP STARTTLS (Port {settings.SMTP_PORT}) Verified\n"
            f"Dispatched At: {now_str}\n"
            f"Sender: {settings.SMTP_FROM_EMAIL}\n"
            f"Target Recipient: {target_recipient}\n\n"
            f"Notice: This is a diagnostic verification test. No tampering incident was logged.\n"
        )

        html_content = f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4fbff; color: #17324d; padding: 24px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #c9eaf7; overflow: hidden; box-shadow: 0 4px 12px rgba(8,47,97,0.06);">
    <div style="background: linear-gradient(135deg, #082F61 0%, #087EE8 100%); color: #ffffff; padding: 20px 24px;">
      <h2 style="margin: 0; font-size: 18px; letter-spacing: 0.5px;">LABGUARD Telemetry Security</h2>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">SMTP Verification Diagnostic Test</p>
    </div>
    <div style="padding: 24px; font-size: 14px; line-height: 1.6;">
      <p>This automated test message confirms that your <strong>Gmail SMTP STARTTLS</strong> connection on port <strong>{settings.SMTP_PORT}</strong> is fully operational.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
        <tr style="border-bottom: 1px solid #eef7fc;">
          <td style="padding: 8px 0; color: #58758d; font-weight: 600;">Status</td>
          <td style="padding: 8px 0; color: #059669; font-weight: bold;">VERIFIED & ACTIVE</td>
        </tr>
        <tr style="border-bottom: 1px solid #eef7fc;">
          <td style="padding: 8px 0; color: #58758d; font-weight: 600;">Dispatch Timestamp</td>
          <td style="padding: 8px 0; font-family: monospace;">{html.escape(now_str)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eef7fc;">
          <td style="padding: 8px 0; color: #58758d; font-weight: 600;">Authorized Sender</td>
          <td style="padding: 8px 0; font-family: monospace;">{html.escape(settings.SMTP_FROM_EMAIL)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #58758d; font-weight: 600;">Alert Recipient</td>
          <td style="padding: 8px 0; font-family: monospace;">{html.escape(target_recipient)}</td>
        </tr>
      </table>
      <div style="padding: 12px 16px; background-color: #eef7fc; border-left: 4px solid #087EE8; border-radius: 8px; font-size: 12px; color: #082F61;">
        <strong>Diagnostic Note:</strong> This test was initiated manually by an authorized operator. No security incident was created.
      </div>
    </div>
    <div style="background: #f4fbff; padding: 14px 24px; font-size: 11px; color: #58758d; border-top: 1px solid #c9eaf7;">
      LABGUARD Cryptographic IoT Security Boundary · Zero-Trust Telemetry Engine
    </div>
  </div>
</body>
</html>"""

        msg.set_content(text_content)
        msg.add_alternative(html_content, subtype="html")

        try:
            with self._create_smtp_connection() as server:
                server.send_message(msg)
            logger.info(f"Test email successfully accepted by Gmail SMTP for {target_recipient}")
            return {
                "success": True,
                "message": f"Test email successfully dispatched to {target_recipient}",
                "recipient": target_recipient,
                "timestamp": now_str,
            }
        except smtplib.SMTPAuthenticationError as auth_err:
            sanitized = self._sanitize_error(auth_err)
            logger.error(f"SMTP authentication rejected by Gmail: {sanitized}")
            return {
                "success": False,
                "message": f"Gmail SMTP authentication rejected: Check your 16-character App Password. Detail: {sanitized}",
                "recipient": target_recipient,
                "timestamp": now_str,
            }
        except Exception as err:
            sanitized = self._sanitize_error(err)
            logger.error(f"Failed to send test email: {sanitized}")
            return {
                "success": False,
                "message": f"SMTP dispatch failed: {sanitized}",
                "recipient": target_recipient,
                "timestamp": now_str,
            }

    def check_cooldown(self, key: str) -> Tuple[bool, float]:
        """Check if an alert key is currently in cooldown. Returns (in_cooldown, remaining_seconds)."""
        now = time.monotonic()
        cooldown = float(settings.ALERT_COOLDOWN_SECONDS)
        with self._lock:
            last_time = self._cooldown_tracker.get(key)
            if last_time is not None:
                elapsed = now - last_time
                if elapsed < cooldown:
                    return True, round(cooldown - elapsed, 1)
            return False, 0.0

    def trigger_tamper_alert_async(
        self,
        record: Dict[str, Any],
        is_simulated: bool = False,
        detection_reason: Optional[str] = None,
        incident_id: Optional[str] = None,
    ):
        """Asynchronously dispatch tamper alert in a background thread without blocking serial ingestion."""
        thread = threading.Thread(
            target=self.send_tamper_alert,
            args=(record, is_simulated, detection_reason, incident_id),
            daemon=True,
            name=f"TamperAlertWorker-{uuid.uuid4().hex[:6]}",
        )
        thread.start()

    def send_tamper_alert(
        self,
        record: Dict[str, Any],
        is_simulated: bool = False,
        detection_reason: Optional[str] = None,
        incident_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Format and send tamper alert email with duplicate suppression, bounded retries, and offline-safe handling."""
        now_dt = datetime.datetime.now()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")

        device_id = str(record.get("device_id", "UNKNOWN-DEVICE"))
        session_id = str(record.get("session_id", "UNKNOWN-SESSION"))
        seq_num = record.get("seq", "N/A")
        inc_id = incident_id or f"INC-{now_dt.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

        cooldown_key = f"{device_id}:{session_id}"
        in_cooldown, remaining = self.check_cooldown(cooldown_key)
        if in_cooldown:
            logger.info(f"Tamper alert for '{cooldown_key}' suppressed by cooldown ({remaining}s remaining)")
            with self._lock:
                self.last_alert_status = "COOLDOWN"
            return {
                "success": True,
                "status": "COOLDOWN_SUPPRESSED",
                "message": f"Tamper alert suppressed by active cooldown window ({remaining}s remaining)",
                "incidentId": inc_id,
            }

        if not self.is_configured():
            msg = "SMTP not configured with Gmail App Password; tamper alert logged locally only (offline operation preserved)"
            logger.warning(msg)
            with self._lock:
                self.last_alert_status = "OFFLINE_UNCONFIGURED"
                self.last_error_message = msg
            return {
                "success": False,
                "status": "NOT_CONFIGURED",
                "message": msg,
                "incidentId": inc_id,
            }

        incident_type = "SIMULATED_TAMPER_INCIDENT" if is_simulated else "CRYPTOGRAPHIC_INTEGRITY_VIOLATION"
        prefix = "[SIMULATED] " if is_simulated else ""
        subject = f"{prefix}[LABGUARD SECURITY ALERT] Tamper Incident Detected on {device_id} ({inc_id})"
        reason = detection_reason or "Cryptographic HMAC-SHA256 checksum mismatch: payload altered in transit"

        msg = email.message.EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"LABGUARD Security Enclave <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = settings.TAMPER_ALERT_TO

        text_content = (
            f"{prefix}LABGUARD TELEMETRY INTEGRITY ALERT — IMMEDIATE ACTION REQUIRED\n\n"
            f"Incident ID:       {inc_id}\n"
            f"Device ID:         {device_id}\n"
            f"Session ID:        {session_id}\n"
            f"Sequence Nonce:    #{seq_num}\n"
            f"Timestamp:         {now_str}\n"
            f"Incident Type:     {incident_type}\n"
            f"Detection Reason:  {reason}\n\n"
            f"RECOMMENDED MITIGATION ACTIONS:\n"
            f"1. Immediately halt or isolate critical laboratory processes associated with {device_id}.\n"
            f"2. Inspect the physical serial USB bus and cable for interposer hardware or signal interference.\n"
            f"3. Verify cryptographic root-of-trust key KEY-001 in the hardware enclave.\n"
            f"4. Inspect raw cryptographic frame in the LABGUARD Record Inspection Console.\n\n"
            f"Confidentiality Notice: Cryptographic keys and raw sensitive payload bytes are strictly omitted pursuant to NIST SP 800-107.\n"
        )

        header_bg = "#dc2626" if not is_simulated else "#d97706"
        header_title = "CRITICAL INTEGRITY VIOLATION DETECTED" if not is_simulated else "SIMULATED TAMPER DEMONSTRATION ALERT"

        html_content = f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fff5f5; color: #17324d; padding: 24px; margin: 0;">
  <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #fecaca; overflow: hidden; box-shadow: 0 4px 14px rgba(220,38,38,0.1);">
    <div style="background-color: {header_bg}; color: #ffffff; padding: 22px 26px;">
      <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; background: rgba(255,255,255,0.25); font-size: 11px; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 8px;">
        {incident_type}
      </span>
      <h2 style="margin: 0; font-size: 18px; letter-spacing: 0.5px;">{header_title}</h2>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.95;">Incident Reference: {html.escape(inc_id)}</p>
    </div>
    <div style="padding: 24px; font-size: 13px; line-height: 1.6;">
      <p style="margin-top: 0; font-size: 14px; color: #082F61;">
        The LABGUARD Cryptographic Ingestion Engine flagged an authoritative non-repudiation failure. Telemetry frame bytes failed verification against the hardware enclave signature.
      </p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px;">
        <tr style="border-bottom: 1px solid #fee2e2;">
          <td style="padding: 8px 0; color: #58758d; font-weight: 600; width: 38%;">Incident ID</td>
          <td style="padding: 8px 0; font-family: monospace; font-weight: bold; color: #dc2626;">{html.escape(inc_id)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #fee2e2;">
          <td style="padding: 8px 0; color: #58758d; font-weight: 600;">Hardware Device</td>
          <td style="padding: 8px 0; font-family: monospace; font-weight: bold;">{html.escape(device_id)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #fee2e2;">
          <td style="padding: 8px 0; color: #58758d; font-weight: 600;">Recording Session</td>
          <td style="padding: 8px 0; font-family: monospace; font-weight: bold; color: #087EE8;">{html.escape(session_id)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #fee2e2;">
          <td style="padding: 8px 0; color: #58758d; font-weight: 600;">Sequence Nonce</td>
          <td style="padding: 8px 0; font-family: monospace;">#{html.escape(str(seq_num))}</td>
        </tr>
        <tr style="border-bottom: 1px solid #fee2e2;">
          <td style="padding: 8px 0; color: #58758d; font-weight: 600;">Timestamp</td>
          <td style="padding: 8px 0; font-family: monospace;">{html.escape(now_str)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #58758d; font-weight: 600;">Detection Reason</td>
          <td style="padding: 8px 0; color: #b91c1c; font-weight: 600;">{html.escape(reason)}</td>
        </tr>
      </table>

      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px 16px; margin: 18px 0;">
        <h4 style="margin: 0 0 8px; color: #991b1b; font-size: 13px;">RECOMMENDED ACTIONS:</h4>
        <ol style="margin: 0; padding-left: 20px; color: #7f1d1d; font-size: 12px; line-height: 1.5;">
          <li>Halt or isolate active laboratory processes associated with node {html.escape(device_id)}.</li>
          <li>Inspect the physical serial USB bus for unauthorized interposer devices or cable taps.</li>
          <li>Verify hardware enclave key integrity (KEY-001) in firmware.</li>
          <li>Review the flagged record #{html.escape(str(seq_num))} in the LABGUARD Record Inspection Console.</li>
        </ol>
      </div>

      <p style="font-size: 11px; color: #58758d; margin-bottom: 0;">
        <strong>Zero-Trust Policy:</strong> In compliance with NIST SP 800-107 and strict zero-trust parameters, secret keys, HMAC digests, and internal credentials are never transmitted via email.
      </p>
    </div>
    <div style="background: #f4fbff; padding: 12px 24px; font-size: 11px; color: #58758d; border-top: 1px solid #c9eaf7;">
      LABGUARD Autonomous Evidence Authentication System · Alert Recipient: {html.escape(settings.TAMPER_ALERT_TO)}
    </div>
  </div>
</body>
</html>"""

        msg.set_content(text_content)
        msg.add_alternative(html_content, subtype="html")

        # Bounded retries: max 2 attempts
        max_attempts = 2
        last_exception: Optional[Exception] = None

        for attempt in range(1, max_attempts + 1):
            try:
                with self._create_smtp_connection() as server:
                    server.send_message(msg)

                # Success: update cooldown and metrics
                with self._lock:
                    self._cooldown_tracker[cooldown_key] = time.monotonic()
                    self.total_alerts_sent += 1
                    self.last_alert_time = now_str
                    self.last_alert_status = "SUCCESS"
                    self.last_error_message = None

                logger.info(f"Tamper alert email successfully dispatched for incident {inc_id} to {settings.TAMPER_ALERT_TO}")
                return {
                    "success": True,
                    "status": "SENT",
                    "incidentId": inc_id,
                    "recipient": settings.TAMPER_ALERT_TO,
                    "timestamp": now_str,
                }
            except Exception as err:
                last_exception = err
                sanitized = self._sanitize_error(err)
                logger.warning(f"SMTP dispatch attempt {attempt}/{max_attempts} failed: {sanitized}")
                if attempt < max_attempts:
                    time.sleep(1.0)

        # All retries exhausted
        sanitized_final = self._sanitize_error(last_exception) if last_exception else "Unknown error"
        with self._lock:
            self.last_alert_status = "FAILED"
            self.last_error_message = sanitized_final

        logger.error(f"Failed to dispatch tamper alert for {inc_id} after {max_attempts} attempts: {sanitized_final}")
        return {
            "success": False,
            "status": "FAILED",
            "message": f"SMTP dispatch failed: {sanitized_final}",
            "incidentId": inc_id,
            "timestamp": now_str,
        }

email_service = EmailService()
