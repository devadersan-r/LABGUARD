#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <mbedtls/md.h>
#include <math.h>
#include <string.h>

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "secrets.h"

// ---------- LABGUARD hardware: UNCHANGED ----------
#define SENSOR_PIN 4
#define OLED_SDA 21
#define OLED_SCL 22

#define RED_PIN   25
#define GREEN_PIN 26
#define BLUE_PIN  27

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_ADDRESS 0x3C

// Common-cathode RGB LED: HIGH turns a channel on.
#define LED_ON HIGH
#define LED_OFF LOW

const char* DEVICE_ID = "DEVICE-01";
const char* SESSION_ID = "SESSION-001";
const char* KEY_ID = "KEY-001";

const unsigned long SAMPLE_INTERVAL_MS = 5000;

// ---------- NEW: Wi-Fi and IFTTT ----------
const char* WIFI_SSID = LABGUARD_WIFI_SSID;
const char* WIFI_PASSWORD = LABGUARD_WIFI_PASSWORD;

const char* IFTTT_EVENT = LABGUARD_IFTTT_EVENT;
const char* IFTTT_KEY = LABGUARD_IFTTT_KEY;

const float ALERT_TEMP = 30.0;
const unsigned long ALERT_INTERVAL_MS = 60000;
const unsigned long WIFI_RETRY_INTERVAL_MS = 10000;

unsigned long lastAlert = 0;
unsigned long lastWiFiRetry = 0;

// ---------- Original hardware objects ----------
Adafruit_SSD1306 display(
  SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1
);

OneWire oneWire(SENSOR_PIN);
DallasTemperature sensors(&oneWire);

unsigned long lastSample = 0;
uint32_t sequenceNumber = 0;
bool oledReady = false;

// ---------- RGB LED: UNCHANGED ----------
void setLED(bool red, bool green, bool blue) {
  digitalWrite(RED_PIN, red ? LED_ON : LED_OFF);
  digitalWrite(GREEN_PIN, green ? LED_ON : LED_OFF);
  digitalWrite(BLUE_PIN, blue ? LED_ON : LED_OFF);
}

// ---------- OLED: UNCHANGED ----------
void showScreen(
  const char* status,
  float temperature,
  bool hasTemperature
) {
  if (!oledReady) return;

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);

  display.println("LABGUARD");
  display.println("----------------");

  if (hasTemperature) {
    display.print("Temp: ");
    display.print(temperature, 2);
    display.println(" C");
  } else {
    display.println("Temp: unavailable");
  }

  display.print("Record: ");
  display.println(sequenceNumber);

  display.print("Status: ");
  display.println(status);

  display.display();
}

// ---------- HMAC-SHA256: UNCHANGED ----------
bool calculateHMAC(
  const char* message,
  char outputHex[65]
) {
  const mbedtls_md_info_t* mdInfo =
    mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);

  if (mdInfo == nullptr) return false;

  unsigned char digest[32];

  int result = mbedtls_md_hmac(
    mdInfo,
    LABGUARD_SECRET_KEY,
    sizeof(LABGUARD_SECRET_KEY),
    reinterpret_cast<const unsigned char*>(message),
    strlen(message),
    digest
  );

  if (result != 0) return false;

  const char hexChars[] = "0123456789abcdef";

  for (int i = 0; i < 32; i++) {
    outputHex[i * 2] = hexChars[digest[i] >> 4];
    outputHex[i * 2 + 1] = hexChars[digest[i] & 0x0F];
  }

  outputHex[64] = '\0';
  return true;
}

// ---------- NEW: Wi-Fi connection ----------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.println("# Connecting to Wi-Fi");

  unsigned long startedAt = millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startedAt < 10000
  ) {
    delay(250);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("# Wi-Fi connected");
    Serial.print("# IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("# Wi-Fi unavailable; local logging continues");
  }
}

// ---------- NEW: IFTTT temperature alert ----------
bool sendEmailAlert(float temperature) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("# IFTTT alert skipped: Wi-Fi disconnected");
    return false;
  }

  WiFiClientSecure client;

  // Demonstration only: skips TLS certificate verification.
  // For production, configure certificate validation.
  client.setInsecure();

  HTTPClient http;

  String url = "https://maker.ifttt.com/trigger/";
  url += IFTTT_EVENT;
  url += "/with/key/";
  url += IFTTT_KEY;

  if (!http.begin(client, url)) {
    Serial.println("# IFTTT: HTTP initialization failed");
    return false;
  }

  http.addHeader("Content-Type", "application/json");

  String body = "{\"value1\":\"";
  body += String(temperature, 2);
  body += "\",\"value2\":\"LABGUARD temperature alert\"";
  body += ",\"value3\":\"ESP32 DS18B20 sensor\"}";

  int responseCode = http.POST(body);

  Serial.print("# IFTTT response: ");
  Serial.println(responseCode);

  http.end();

  if (responseCode >= 200 && responseCode < 300) {
    Serial.println("# IFTTT alert request accepted");
    return true;
  }

  Serial.println("# IFTTT alert request failed");
  return false;
}

// ---------- Setup ----------
void setup() {
  Serial.begin(115200);

  // Original RGB LED setup
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);
  setLED(false, false, true);

  // Original OLED setup
  Wire.begin(OLED_SDA, OLED_SCL);

  oledReady = display.begin(
    SSD1306_SWITCHCAPVCC, OLED_ADDRESS
  );

  if (oledReady) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("LABGUARD");
    display.println("Initializing...");
    display.display();
  }

  // Original DS18B20 setup
  sensors.begin();

  Serial.println("# LABGUARD started");
  Serial.println("# JSONL records follow");

  showScreen("INITIALIZING", NAN, false);

  setLED(false, true, false);

  // New Wi-Fi setup. Failure does not stop local logging.
  connectWiFi();
}

// ---------- Main loop ----------
void loop() {
  // NEW: reconnect periodically without blocking sensor logging
  if (
    WiFi.status() != WL_CONNECTED &&
    millis() - lastWiFiRetry >= WIFI_RETRY_INTERVAL_MS
  ) {
    lastWiFiRetry = millis();
    connectWiFi();
  }

  // Original 5-second sampling interval
  if (
    millis() - lastSample < SAMPLE_INTERVAL_MS &&
    lastSample != 0
  ) {
    return;
  }

  lastSample = millis();

  sensors.requestTemperatures();
  float temperature = sensors.getTempCByIndex(0);

  // Original sensor validation
  if (
    temperature == DEVICE_DISCONNECTED_C ||
    isnan(temperature) ||
    temperature < -55.0 ||
    temperature > 125.0
  ) {
    setLED(true, false, false);
    showScreen("SENSOR ERROR", NAN, false);
    Serial.println("# ERROR: DS18B20 unavailable");
    return;
  }

  sequenceNumber++;

  unsigned long elapsedMs = millis();
  char tempStr[16];

  snprintf(tempStr, sizeof(tempStr), "%.2f", temperature);

  // ORIGINAL canonical authenticated bytes: UNCHANGED
  char canonical[192];

  snprintf(
    canonical,
    sizeof(canonical),
    "lablog-v1|%s|%s|%lu|%lu|DS18B20|%s|C",
    SESSION_ID,
    DEVICE_ID,
    (unsigned long)sequenceNumber,
    elapsedMs,
    tempStr
  );

  char tag[65];

  if (!calculateHMAC(canonical, tag)) {
    setLED(true, false, false);
    showScreen("HMAC ERROR", temperature, true);
    Serial.println("# ERROR: HMAC calculation failed");
    return;
  }

  // ORIGINAL JSONL evidence record: UNCHANGED
  Serial.print("{\"schema\":\"lablog-v1\"");
  Serial.print(",\"session_id\":\"");
  Serial.print(SESSION_ID);
  Serial.print("\"");

  Serial.print(",\"device_id\":\"");
  Serial.print(DEVICE_ID);
  Serial.print("\"");

  Serial.print(",\"seq\":");
  Serial.print(sequenceNumber);

  Serial.print(",\"elapsed_ms\":");
  Serial.print(elapsedMs);

  Serial.print(",\"source\":\"DS18B20\"");
  Serial.print(",\"value\":");
  Serial.print(tempStr);
  Serial.print(",\"unit\":\"C\"");

  Serial.print(",\"auth\":{\"algorithm\":\"HMAC-SHA256\"");
  Serial.print(",\"key_id\":\"");
  Serial.print(KEY_ID);
  Serial.print("\"");

  Serial.print(",\"tag\":\"");
  Serial.print(tag);
  Serial.println("\"}}");

  // Original success indication
  setLED(false, true, false);
  showScreen("TAG CREATED", temperature, true);

  // NEW: send IFTTT alert when temperature is high
  bool alert = temperature >= ALERT_TEMP;

  if (
    alert &&
    (
      lastAlert == 0 ||
      millis() - lastAlert >= ALERT_INTERVAL_MS
    )
  ) {
    if (sendEmailAlert(temperature)) {
      lastAlert = millis();
    }
  }

  if (alert) {
    Serial.println("# WARNING: Temperature threshold reached");
  }
}


