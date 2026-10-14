
#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// DS18B20 data pin
#define ONE_WIRE_BUS 4

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=== DS18B20 SENSOR TEST ===");

  sensors.begin();

  int count = sensors.getDeviceCount();

  Serial.print("Sensors detected: ");
  Serial.println(count);

  if (count == 0) {
    Serial.println("ERROR: DS18B20 not detected!");
    Serial.println("Check GPIO 4, VCC, GND and 4.7k resistor.");
  } else {
    Serial.println("DS18B20 detected successfully!");
  }
}

void loop() {
  sensors.requestTemperatures();

  float tempC = sensors.getTempCByIndex(0);

  if (tempC == DEVICE_DISCONNECTED_C) {
    Serial.println("ERROR: Sensor disconnected or unreadable.");
  } else if (tempC == 85.0) {
    Serial.println("WARNING: 85 C reading; check sensor power and wiring.");
  } else if (tempC < -55.0 || tempC > 125.0) {
    Serial.println("ERROR: Temperature outside DS18B20 range.");
  } else {
    Serial.print("Temperature: ");
    Serial.print(tempC, 2);
    Serial.println(" C");

    Serial.print("Temperature: ");
    Serial.print((tempC * 9.0 / 5.0) + 32.0, 2);
    Serial.println(" F");
  }

  Serial.println("------------------------");
  delay(2000);
}

