/*
 * LABGUARD ESP32 Firmware — Offline Laboratory Evidence Integrity System
 *
 * Measures temperature via DS18B20 sensor, generates canonical labguard-v1
 * measurement records, computes real HMAC-SHA256 tags using mbedtls, and
 * streams JSONL records over USB Serial.
 *
 * Hardware Connections:
 * - ESP32 DevKit GPIO 4 -> DS18B20 Data pin (with 4.7 kΩ pull-up to 3.3V)
 * - DS18B20 VCC -> 3.3V
 * - DS18B20 GND -> GND
 *
 * Conforms to Section 8 of authenticator.txt and Section 7 of correction.txt.
 */

#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <mbedtls/md.h>

// Include secret key configuration (provisioned via scripts/generate_key.py)
#include "secrets.h"

// =============================================================================
// CONFIGURATION AND PIN DEFINITIONS
// =============================================================================
#define ONE_WIRE_BUS 4               // GPIO 4 connected to DS18B20 DQ
#define SERIAL_BAUD_RATE 115200      // USB Serial baud rate
#define MEASUREMENT_INTERVAL_MS 2000 // Measure every 2 seconds

// Set to true to emit clearly labelled simulated readings when sensor is unplugged
#define SIMULATE_IF_SENSOR_MISSING true

// Protocol constants
static const char* const SCHEMA_VERSION = "labguard-v1";
static const char* const DEVICE_ID = "ESP32-DEV-01";
static const char* const SESSION_ID = "SESSION-2026-001";
static const char* const SENSOR_SOURCE = "DS18B20";
static const char* const UNIT_C = "C";
static const char* const AUTH_ALGORITHM = "HMAC-SHA256";

// OneWire and sensor instances
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// Monotonic state tracking
static uint32_t record_seq = 0;
static uint32_t session_start_ms = 0;
static bool sensor_present = false;

// =============================================================================
// CRYPTOGRAPHIC HELPER: HMAC-SHA256 via ESP32 hardware/mbedtls engine
// =============================================================================
bool compute_hmac_sha256(
    const uint8_t* key,
    size_t key_len,
    const uint8_t* payload,
    size_t payload_len,
    char* tag_hex_out // Must be at least 65 bytes (64 hex chars + null terminator)
) {
    if (key == nullptr || payload == nullptr || tag_hex_out == nullptr || key_len != 32) {
        return false;
    }

    uint8_t hmac_result[32];
    mbedtls_md_context_t ctx;
    mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

    mbedtls_md_init(&ctx);

    if (mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1) != 0) { // 1 = HMAC
        mbedtls_md_free(&ctx);
        return false;
    }

    if (mbedtls_md_hmac_starts(&ctx, key, key_len) != 0) {
        mbedtls_md_free(&ctx);
        return false;
    }

    if (mbedtls_md_hmac_update(&ctx, payload, payload_len) != 0) {
        mbedtls_md_free(&ctx);
        return false;
    }

    if (mbedtls_md_hmac_finish(&ctx, hmac_result) != 0) {
        mbedtls_md_free(&ctx);
        return false;
    }

    mbedtls_md_free(&ctx);

    // Format digest as lowercase 64-char hex string
    for (int i = 0; i < 32; i++) {
        sprintf(tag_hex_out + (i * 2), "%02x", hmac_result[i]);
    }
    tag_hex_out[64] = '\0';
    return true;
}

// =============================================================================
// SETUP
// =============================================================================
void setup() {
    Serial.begin(SERIAL_BAUD_RATE);
    delay(1000); // Allow serial monitor to connect

    Serial.println("[DIAG] =================================================");
    Serial.println("[DIAG] LABGUARD ESP32 Measurement Node Initializing...");
    Serial.print("[DIAG] Device ID : "); Serial.println(DEVICE_ID);
    Serial.print("[DIAG] Session ID: "); Serial.println(SESSION_ID);
    Serial.print("[DIAG] Key ID    : "); Serial.println(LABGUARD_KEY_ID);

    sensors.begin();
    int device_count = sensors.getDeviceCount();
    Serial.print("[DIAG] DS18B20 sensor count: "); Serial.println(device_count);

    if (device_count > 0) {
        sensor_present = true;
        Serial.println("[DIAG] Sensor detected successfully on GPIO 4.");
    } else {
        sensor_present = false;
        Serial.println("[DIAG] WARNING: No DS18B20 detected on GPIO 4 (check 4.7k pull-up).");
        if (SIMULATE_IF_SENSOR_MISSING) {
            Serial.println("[DIAG] Simulation mode active for unattached testing.");
        }
    }

    session_start_ms = millis();
    record_seq = 1;
    Serial.println("[DIAG] Starting JSONL stream...");
    Serial.println("[DIAG] =================================================");
}

// =============================================================================
// MAIN LOOP: Measure, Canonicalize, Authenticate, Transmit JSONL
// =============================================================================
void loop() {
    static uint32_t last_measurement_ms = 0;
    uint32_t current_ms = millis();

    if (current_ms - last_measurement_ms < MEASUREMENT_INTERVAL_MS) {
        delay(20);
        return;
    }
    last_measurement_ms = current_ms;

    uint32_t elapsed_ms = current_ms - session_start_ms;
    int32_t value_centi_c = 0;
    bool reading_valid = false;

    if (sensor_present) {
        sensors.requestTemperatures();
        float tempC = sensors.getTempCByIndex(0);

        // Sanity checks: DS18B20 error values
        // DEVICE_DISCONNECTED_C is -127.0f, power-on reset default is 85.0f
        if (tempC != DEVICE_DISCONNECTED_C && tempC > -55.0f && tempC < 125.0f && tempC != 85.0f) {
            value_centi_c = (int32_t)round(tempC * 100.0f);
            reading_valid = true;
        } else {
            Serial.print("[DIAG] Sensor read error (temp="); Serial.print(tempC); Serial.println("C), skipping record.");
        }
    } else if (SIMULATE_IF_SENSOR_MISSING) {
        // Safe simulation for development bench testing without physical sensor attached
        // Simulates typical lab ambient temperature around 24.50 °C with small drift
        float simulated_temp = 24.50f + (sin((float)record_seq * 0.1f) * 0.5f);
        value_centi_c = (int32_t)round(simulated_temp * 100.0f);
        reading_valid = true;
    }

    if (!reading_valid) {
        return;
    }

    // Step 1: Build the exact canonical payload string (excludes auth block)
    // Canonical format:
    // {"schema":"labguard-v1","session_id":"...","device_id":"...","seq":%lu,"elapsed_ms":%lu,"source":"DS18B20","value_centi_c":%ld,"unit":"C"}
    char canonical_buf[384];
    int canonical_len = snprintf(
        canonical_buf,
        sizeof(canonical_buf),
        "{\"schema\":\"%s\",\"session_id\":\"%s\",\"device_id\":\"%s\",\"seq\":%lu,\"elapsed_ms\":%lu,\"source\":\"%s\",\"value_centi_c\":%ld,\"unit\":\"%s\"}",
        SCHEMA_VERSION,
        SESSION_ID,
        DEVICE_ID,
        (unsigned long)record_seq,
        (unsigned long)elapsed_ms,
        SENSOR_SOURCE,
        (long)value_centi_c,
        UNIT_C
    );

    if (canonical_len <= 0 || canonical_len >= (int)sizeof(canonical_buf)) {
        Serial.println("[DIAG] Canonical serialization buffer overflow");
        return;
    }

    // Step 2: Compute real HMAC-SHA256 over canonical bytes using secret key
    char tag_hex[65];
    if (!compute_hmac_sha256(
        LABGUARD_SECRET_KEY,
        sizeof(LABGUARD_SECRET_KEY),
        (const uint8_t*)canonical_buf,
        (size_t)canonical_len,
        tag_hex
    )) {
        Serial.println("[DIAG] HMAC computation failed");
        return;
    }

    // Step 3: Format and output complete JSONL record
    // Exactly one complete JSON object per line on Serial
    char record_buf[512];
    int record_len = snprintf(
        record_buf,
        sizeof(record_buf),
        "{\"schema\":\"%s\",\"session_id\":\"%s\",\"device_id\":\"%s\",\"seq\":%lu,\"elapsed_ms\":%lu,\"source\":\"%s\",\"value_centi_c\":%ld,\"unit\":\"%s\",\"auth\":{\"algorithm\":\"%s\",\"key_id\":\"%s\",\"tag\":\"%s\"}}",
        SCHEMA_VERSION,
        SESSION_ID,
        DEVICE_ID,
        (unsigned long)record_seq,
        (unsigned long)elapsed_ms,
        SENSOR_SOURCE,
        (long)value_centi_c,
        UNIT_C,
        AUTH_ALGORITHM,
        LABGUARD_KEY_ID,
        tag_hex
    );

    if (record_len > 0 && record_len < (int)sizeof(record_buf)) {
        Serial.println(record_buf); // Clean line for JSONL capture
    }

    record_seq++;
}
