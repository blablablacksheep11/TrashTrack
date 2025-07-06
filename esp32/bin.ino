#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include <SPI.h>
#include <MFRC522.h>

#define binID 1
#define irPin 32
#define trigPin 27
#define echoPin 35
#define servoPin 5
#define redledPin 13
#define greenledPin 12
#define RST_PIN 16
#define SS_PIN 17

MFRC522 rfid(SS_PIN, RST_PIN);
MFRC522::MIFARE_Key key;

const char* ssid = "Wifi name here";                                // WiFi name
const char* password = "Wifi password here";                             // WiFi password
const char* serverUrl = "http://192.168.0.105:3000/esp32Data";  // Computer IP address (v4)

bool opened = false;
bool closed = false;
bool binstatus = true;
bool collection = false;
double duration, distance, accumulation;
unsigned long lastCheckTime = 0;
const long checkInterval = 1;
String jsonOutput = "";
Servo myServo;

void setup() {
  pinMode(greenledPin, OUTPUT);
  pinMode(redledPin, OUTPUT);
  pinMode(irPin, INPUT);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

  myServo.attach(servoPin);
  myServo.write(0);

  SPI.begin();  // SCK=18, MISO=19, MOSI=23 by default for ESP32
  rfid.PCD_Init();

  for (int i = 0; i < 6; i++) {
    key.keyByte[i] = 0xFF;
  }

  Serial.begin(115200);
}

void loop() {
  checkRFID();

  if (accumulation >= 80) {
    digitalWrite(redledPin, HIGH);
    digitalWrite(greenledPin, LOW);
    if (!collection) return;
  } else {
    digitalWrite(redledPin, LOW);
    digitalWrite(greenledPin, HIGH);
  }

  int sensorState = digitalRead(irPin);

  if (sensorState == LOW) {
    Serial.println("Bin opened");
    if (binstatus) {
      myServo.write(85);
      if (!opened) {
        closed = false;
        if (WiFi.status() == WL_CONNECTED) {
          HTTPClient http;

          http.begin(serverUrl);                               // Specify destination
          http.addHeader("Content-Type", "application/json");  // Set content-type

          String data = "{\"binID\":" + String(binID) + ",\"binstatus\": \"opened\"}";
          http.POST(data);

          http.end();
        }
        opened = true;
      }
      delay(1000);
    } else {
      closed = false;
      opened = true;
      return;
    }
  } else {
    Serial.println("Bin closed");
    myServo.write(0);
    delay(2000);

    if (!closed) {
      opened = false;

      digitalWrite(trigPin, LOW);
      delayMicroseconds(2);
      digitalWrite(trigPin, HIGH);
      delayMicroseconds(10);
      digitalWrite(trigPin, LOW);

      duration = pulseIn(echoPin, HIGH);
      distance = (duration * 0.0343) / 2;
      accumulation = 100 - ((distance / 23.5) * 100);

      if (accumulation >= 80) {
        digitalWrite(redledPin, HIGH);
        digitalWrite(greenledPin, LOW);
        if (!collection) binstatus = false;
      } else {
        digitalWrite(redledPin, LOW);
        digitalWrite(greenledPin, HIGH);
        binstatus = true;
      }

      if (distance <= 0) distance = 0;
      else if (distance >= 23.5) distance = 23.5;

      if (collection) {
        if (accumulation < 80) {
          if (WiFi.status() == WL_CONNECTED) {
            HTTPClient http;

            http.begin(serverUrl);                               // Specify destination
            http.addHeader("Content-Type", "application/json");  // Set content-type

            http.POST(jsonOutput);

            http.end();
          }
        }
        collection = false;
      } else {
        if (WiFi.status() == WL_CONNECTED) {
          HTTPClient http;

          http.begin(serverUrl);                               // Specify destination
          http.addHeader("Content-Type", "application/json");  // Set content-type

          String data = "{\"binID\":" + String(binID) + ",\"binstatus\": \"closed\", \"distance\": " + String(distance) + "}";
          http.POST(data);

          http.end();
        }
      }
      closed = true;
    }
  }
}

void checkRFID() {
  if (millis() - lastCheckTime >= checkInterval) {
    lastCheckTime = millis();

    if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

    binstatus = true;
    collection = true;
    byte buffer[18];
    byte buffersize = sizeof(buffer);
    String fields[] = { "cleanerID", "Name" };

    byte status;
    byte block = 1;
    int startingblock, trailerblock, counter = 0;
    int fieldCount = 2;
    jsonOutput = "{\"binid\": " + String(binID) + ", ";

    for (byte i = 0; i < fieldCount; i++) {
      startingblock = block / 4 * 4;
      trailerblock = startingblock + 3;

      status = rfid.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, trailerblock, &key, &(rfid.uid));
      if (status != MFRC522::STATUS_OK) {
        return;
      }

      if (block == trailerblock) {
        fieldCount += 1;
      } else {
        status = rfid.MIFARE_Read(block, buffer, &buffersize);
        if (status == MFRC522::STATUS_OK) {
          jsonOutput += "\"" + fields[counter] + "\": \"";

          for (byte j = 0; j < 16; j++) {
            if (buffer[j] != 0x00) {  // Ignore null bytes
              jsonOutput += (char)buffer[j];
            }
          }

          jsonOutput += "\"";
          if (counter < fieldCount - 1) {
            jsonOutput += ", ";
          }
        }
        counter++;
      }
      block++;
    }

    jsonOutput += "}";
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }
}
