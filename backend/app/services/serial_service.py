import datetime
import json
import math
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple
import serial
import serial.tools.list_ports

from backend.app.core.config import settings
from backend.app.core.logging_config import logger
from backend.app.services.authenticator_service import authenticator_service

class SerialService:
    def __init__(self):
        self._lock = threading.RLock()
        self._serial_conn: Optional[serial.Serial] = None
        self._reader_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        # Connection status tracking
        self.connected: bool = False
        self.current_port: Optional[str] = None
        self.baud_rate: int = settings.DEFAULT_BAUD_RATE
        self.bytes_received: int = 0
        self.packets_received: int = 0
        self.valid_packets: int = 0
        self.invalid_packets: int = 0
        self.last_packet_time: Optional[str] = None
        self.last_error: Optional[str] = None
        self.connected_since: Optional[str] = None

        import collections
        self._packet_timestamps = collections.deque(maxlen=200)

        # Simulator state for offline bench testing
        self.simulator_active: bool = False
        self._simulator_thread: Optional[threading.Thread] = None
        self._sim_stop_event = threading.Event()
        self._sim_seq: int = 1
        self._sim_start_time: float = 0.0

        # Callback for incoming valid/invalid evidence records (for DB storage and live updates)
        self.on_record_received: Optional[Callable[[Dict[str, Any], bool, Optional[str], bool], None]] = None

    def get_current_throughput(self) -> int:
        """Calculate real-time record ingest throughput over the last 2 seconds (0 when idle or disconnected)."""
        with self._lock:
            if not self.connected and not self.simulator_active:
                return 0
            now = time.monotonic()
            recent_count = sum(1 for t in self._packet_timestamps if t > (now - 2.0))
            return int(round(recent_count / 2.0))

    def list_ports(self) -> List[Dict[str, str]]:
        """List all available Windows COM ports with description and hardware ID."""
        ports = []
        try:
            for p in serial.tools.list_ports.comports():
                ports.append({
                    "port": p.device,
                    "description": p.description or "Serial Port",
                    "hwid": p.hwid or "Unknown",
                })
        except Exception as err:
            logger.error(f"Error enumerating serial ports: {err}")
        return ports

    def get_status(self) -> Dict[str, Any]:
        """Return thread-safe snapshot of connection status."""
        with self._lock:
            now = time.monotonic()
            recent_count = sum(1 for t in self._packet_timestamps if t > (now - 2.0)) if (self.connected or self.simulator_active) else 0
            current_throughput = int(round(recent_count / 2.0))
            return {
                "connected": self.connected,
                "port": self.current_port,
                "baudRate": self.baud_rate,
                "bytesReceived": self.bytes_received,
                "packetsReceived": self.packets_received,
                "validPackets": self.valid_packets,
                "invalidPackets": self.invalid_packets,
                "lastPacketTime": self.last_packet_time,
                "lastError": self.last_error,
                "connectedSince": self.connected_since,
                "simulatorActive": self.simulator_active,
                "throughput": current_throughput,
            }

    def reset_stats(self):
        """Reset serial packet counters, last packet time, error, and throughput to zero baseline."""
        with self._lock:
            self.bytes_received = 0
            self.packets_received = 0
            self.valid_packets = 0
            self.invalid_packets = 0
            self.last_packet_time = None
            self.last_error = None
            self.connected_since = None
            self._packet_timestamps.clear()

    def connect(self, port: str, baud_rate: int = 115200) -> Tuple[bool, str]:
        """Connect to the specified serial port safely."""
        with self._lock:
            if self.connected:
                if self.current_port == port:
                    return True, f"Already connected to {port}"
                self._disconnect_internal()

            # If simulator is running, stop it when real hardware connects
            if self.simulator_active:
                self._stop_simulator_internal()

            try:
                logger.info(f"Connecting to serial port {port} at {baud_rate} baud...")
                self._serial_conn = serial.Serial(
                    port=port,
                    baudrate=baud_rate,
                    timeout=settings.SERIAL_TIMEOUT_SECONDS,
                )
                self.connected = True
                self.current_port = port
                self.baud_rate = baud_rate
                self.connected_since = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                self.last_error = None

                self._stop_event.clear()
                self._reader_thread = threading.Thread(
                    target=self._reader_worker,
                    daemon=True,
                    name=f"SerialReader-{port}",
                )
                self._reader_thread.start()
                logger.info(f"Serial reader worker started on {port}")
                return True, f"Successfully connected to {port}"
            except serial.SerialException as err:
                self.connected = False
                self.current_port = None
                self.last_error = f"Serial error: {err}"
                logger.error(f"Failed to open port {port}: {err}")
                return False, f"Could not open {port}: {err}"
            except Exception as err:
                self.connected = False
                self.current_port = None
                self.last_error = f"Unexpected error: {err}"
                logger.error(f"Error opening port {port}: {err}")
                return False, f"Error: {err}"

    def disconnect(self) -> Tuple[bool, str]:
        """Disconnect safely from current serial port."""
        with self._lock:
            return self._disconnect_internal()

    def _disconnect_internal(self) -> Tuple[bool, str]:
        if not self.connected and self._serial_conn is None:
            return True, "Serial port is already disconnected"

        self._stop_event.set()
        conn = self._serial_conn
        self._serial_conn = None
        self.connected = False
        port_name = self.current_port or "device"
        self.current_port = None

        if conn:
            try:
                conn.close()
            except Exception as err:
                logger.warning(f"Error closing serial connection: {err}")

        reader = self._reader_thread
        self._reader_thread = None
        if reader and reader.is_alive() and threading.current_thread() != reader:
            try:
                reader.join(timeout=0.3)
            except Exception:
                pass

        logger.info(f"Safely disconnected from {port_name}")
        self.reset_stats()
        return True, f"Disconnected from {port_name}"

    def _reader_worker(self):
        """Background thread reading incoming lines from USB Serial."""
        buffer = bytearray()
        while not self._stop_event.is_set():
            if not self._serial_conn or not self._serial_conn.is_open:
                break

            try:
                data = self._serial_conn.read(self._serial_conn.in_waiting or 1)
                if not data:
                    time.sleep(0.02)
                    continue

                with self._lock:
                    self.bytes_received += len(data)

                buffer.extend(data)

                while b"\n" in buffer:
                    line_bytes, _, remaining = buffer.partition(b"\n")
                    buffer = bytearray(remaining)

                    line_str = line_bytes.decode("utf-8", errors="replace").strip()
                    if not line_str:
                        continue

                    self._process_incoming_line(line_str, is_simulated=False)

            except serial.SerialException as err:
                logger.error(f"Serial I/O error during read: {err}")
                with self._lock:
                    self.last_error = f"Connection lost: {err}"
                    self.connected = False
                break
            except Exception as err:
                logger.error(f"Unexpected error in reader thread: {err}")
                time.sleep(0.1)

        with self._lock:
            self.connected = False
            if self._serial_conn:
                try:
                    self._serial_conn.close()
                except Exception:
                    pass
                self._serial_conn = None

    def _process_incoming_line(self, line: str, is_simulated: bool = False):
        """Process incoming raw line from hardware or simulator."""
        # 1. Filter out diagnostic logs (starting with [DIAG])
        if line.startswith("[DIAG]"):
            logger.debug(f"Hardware Diag: {line}")
            return

        # 2. Evidence records must be JSON objects
        if not line.startswith("{"):
            logger.debug(f"Ignored non-JSON serial line: {line[:40]}")
            return

        with self._lock:
            self.packets_received += 1
            self.last_packet_time = datetime.datetime.now().strftime("%H:%M:%S")
            self._packet_timestamps.append(time.monotonic())

        try:
            record = json.loads(line)
        except Exception as err:
            with self._lock:
                self.invalid_packets += 1
                self.last_error = f"Malformed JSON: {err}"
            logger.warning(f"Malformed serial JSON: {err}")
            return

        # Cryptographic verification immediately on ingress
        try:
            is_valid, status, reason, expected_tag = authenticator_service.verify_single_record(record)
        except Exception as err:
            logger.error(f"Error during verify_single_record on incoming line: {err}")
            is_valid = False
            status = "INVALID"
            reason = f"Verification error: {err}"
            expected_tag = None

        with self._lock:
            if is_valid:
                self.valid_packets += 1
            else:
                self.invalid_packets += 1
                self.last_error = reason

        # Dispatch to callback for database persistence and live updates
        if self.on_record_received:
            try:
                self.on_record_received(record, is_valid, reason, is_simulated)
            except Exception as err:
                logger.error(f"Error in on_record_received callback: {err}")

    # ==================== Development Simulator ====================
    def start_simulator(self, interval_seconds: float = 2.0) -> Tuple[bool, str]:
        """Start explicitly simulated hardware stream for testing without ESP32."""
        with self._lock:
            if self.simulator_active:
                return True, "Simulator is already active"

            self.simulator_active = True
            self._sim_stop_event.clear()
            self._sim_seq = 1
            self._sim_start_time = time.time()
            self.connected_since = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            self._simulator_thread = threading.Thread(
                target=self._simulator_worker,
                args=(interval_seconds,),
                daemon=True,
                name="HardwareSimulator",
            )
            self._simulator_thread.start()
            logger.info("Explicit hardware demonstration simulator started")
            return True, "Simulator stream started"

    def _stop_simulator_internal(self) -> Tuple[bool, str]:
        if not self.simulator_active:
            return True, "Simulator is not active"

        self._sim_stop_event.set()
        self.simulator_active = False
        self.reset_stats()
        logger.info("Hardware demonstration simulator stopped")
        return True, "Simulator stream stopped"

    def stop_simulator(self) -> Tuple[bool, str]:
        """Stop the simulator stream."""
        with self._lock:
            return self._stop_simulator_internal()

    def _simulator_worker(self, interval: float):
        """Generate cryptographically valid labguard-v1 records periodically."""
        from backend.app.services.session_service import session_service

        while not self._sim_stop_event.is_set():
            time.sleep(interval)
            if self._sim_stop_event.is_set():
                break

            # Simulate lab ambient temperature ~24.50 °C with small drift
            elapsed_ms = int((time.time() - self._sim_start_time) * 1000)
            temp = 24.50 + math.sin(self._sim_seq * 0.15) * 0.45
            centi = int(round(temp * 100))

            try:
                active_session = session_service.get_active_session_id() or "SESSION-SIM-LIVE"
                record = authenticator_service.sign_record(
                    session_id=active_session,
                    device_id="ESP32-DEV-01",
                    seq=self._sim_seq,
                    elapsed_ms=elapsed_ms,
                    source="DS18B20-SIMULATED",
                    value_centi_c=centi,
                    key_id="KEY-001",
                )
                self._sim_seq += 1
                record_json = json.dumps(record, separators=(",", ":"))
                self._process_incoming_line(record_json, is_simulated=True)
            except Exception as err:
                logger.error(f"Simulator error generating record: {err}")

serial_service = SerialService()
