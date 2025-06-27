#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include <SPI.h>
#include <MFRC522.h>

#define binID 1

// Infrared light sensor pin
#define irPin 4

// Ultrasonic sensor pins
#define trigPin1 14
#define echoPin1 34
#define trigPin2 13
#define echoPin2 35
#define trigPin3 16
#define echoPin3 33

// MG996 servo motor pins
#define lidServoPin 17            // 0 degree, put at RHS, wire face front, 90 degree open
#define armVerticalServoPin 32    // Origin: 90 degree, Under camera: 105 degree
#define armHorizontalServoPin 22  // Origin: 52 degree, Cat1: 30 degree, Cat3: 74 degree
#define cover1ServoPin1 25        // Rotate from 0 to 90
#define cover2ServoPin2 26        // Rotate from 0 to 90
#define cover3ServoPin3 27        // Rotate from 87 to 0

// RFID pins
#define RST_PIN 21
#define SS_PIN 5
// SCK=18, MISO=19, MOSI=23

MFRC522 rfid(SS_PIN, RST_PIN);
MFRC522::MIFARE_Key key;

const char *ssid = "WiFi_NAME_HERE";                                   // WiFi name
const char *password = "WiFi_PASSWORD_HERE";                           // WiFi password
const char *serverUrl = "http://LOCALHOST_IPV4_HERE:3000/esp32data";  // Computer IP address (v4)

WebServer server(80);  // ESP32 runs on port 80

bool opened = false;
bool closed = false;
bool binstatus = true;
bool isInitial = true;
int categoryID = 0;
double duration, distance, occupiedDistance, remainingDistance, accumulation;
unsigned long lastCheckTime = 0;
const long checkInterval = 1000;
String jsonOutput = "";
Servo lidServo, armVerticalServo, armHorizontalServo, cover1Servo, cover2Servo, cover3Servo;

void checkRFID() {
  if (millis() - lastCheckTime >= checkInterval) {
    lastCheckTime = millis();

    if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial())
      return;

    binstatus = true;
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

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;

      http.begin(serverUrl);                               // Specify destination
      http.addHeader("Content-Type", "application/json");  // Set content-type

      http.POST(jsonOutput);

      http.end();
    }

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }
}

void handlePost() {
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    StaticJsonDocument<200> data;
    DeserializationError error = deserializeJson(data, body);

    if (error) {
      Serial.print("JSON parse error: ");
      Serial.println(error.c_str());
      server.send(400, "application/json", "{\"status\":\"invalid json\"}");
      return;
    }

    server.send(200, "text/plain", "Data received by ESP32.");

    String category = data["category"];
    Serial.println(category);

    if (category == "paper") {
      categoryID = 1;

      armVerticalServo.write(90);
      delay(1000);
      armHorizontalServo.write(30);
      delay(1000);
      cover1Servo.write(75);
      delay(1000);
      armVerticalServo.write(50);
      delay(3000);
      cover1Servo.write(7);
      delay(1000);
      armVerticalServo.write(90);
      delay(1000);
      armHorizontalServo.write(52);
      delay(1000);

      digitalWrite(trigPin1, LOW);
      delayMicroseconds(2);
      digitalWrite(trigPin1, HIGH);
      delayMicroseconds(10);
      digitalWrite(trigPin1, LOW);

      duration = pulseIn(echoPin1, HIGH);
      distance = (duration * 0.0343) / 2;
      occupiedDistance = 22.7 - distance;
      occupiedDistance = occupiedDistance > 11.5 ? 11.5 : occupiedDistance;
      remainingDistance = 11.5 - occupiedDistance;
      remainingDistance = remainingDistance > 11.5 ? 11.5 : remainingDistance;
      accumulation = 100 - ((remainingDistance / 11.5) * 100);

    } else if (category == "plastic") {
      categoryID = 2;

      armVerticalServo.write(90);
      delay(1000);
      cover2Servo.write(75);
      delay(1000);
      armVerticalServo.write(50);
      delay(3000);
      cover2Servo.write(0);
      delay(1000);
      armVerticalServo.write(90);
      delay(1000);

      digitalWrite(trigPin2, LOW);
      delayMicroseconds(2);
      digitalWrite(trigPin2, HIGH);
      delayMicroseconds(10);
      digitalWrite(trigPin2, LOW);

      duration = pulseIn(echoPin2, HIGH);
      distance = (duration * 0.0343) / 2;
      occupiedDistance = 22.7 - distance;
      occupiedDistance = occupiedDistance > 11.5 ? 11.5 : occupiedDistance;
      remainingDistance = 11.5 - occupiedDistance;
      remainingDistance = remainingDistance > 11.5 ? 11.5 : remainingDistance;
      accumulation = 100 - ((remainingDistance / 11.5) * 100);

    } else if (category == "general") {
      categoryID = 3;

      armVerticalServo.write(90);
      delay(1000);
      armHorizontalServo.write(74);
      delay(1000);
      cover3Servo.write(20);
      delay(1000);
      armVerticalServo.write(50);
      delay(3000);
      cover3Servo.write(87);
      delay(1000);
      armVerticalServo.write(90);
      delay(1000);
      armHorizontalServo.write(52);
      delay(1000);

      digitalWrite(trigPin3, LOW);
      delayMicroseconds(2);
      digitalWrite(trigPin3, HIGH);
      delayMicroseconds(10);
      digitalWrite(trigPin3, LOW);

      duration = pulseIn(echoPin3, HIGH);
      distance = (duration * 0.0343) / 2;
      occupiedDistance = 22.7 - distance;
      occupiedDistance = occupiedDistance > 11.5 ? 11.5 : occupiedDistance;
      remainingDistance = 11.5 - occupiedDistance;
      remainingDistance = remainingDistance > 11.5 ? 11.5 : remainingDistance;
      accumulation = 100 - ((remainingDistance / 11.5) * 100);
    }

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;

      http.begin(serverUrl);                               // Specify destination
      http.addHeader("Content-Type", "application/json");  // Set content-type

      String data = "{\"binID\":" + String(binID) + ",\"category\":" + categoryID + ", \"remainingDistance\": " + String(remainingDistance) + "}";
      http.POST(data);

      http.end();
    }

    if (accumulation >= 80) {
      binstatus = false;
    } else {
      binstatus = true;
    }

    isInitial = true;

  } else {
    server.send(400, "text/plain", "Bad Request");
  }
}

void setup() {
  pinMode(irPin, INPUT);
  pinMode(trigPin1, OUTPUT);
  pinMode(echoPin1, INPUT);
  pinMode(trigPin2, OUTPUT);
  pinMode(echoPin2, INPUT);
  pinMode(trigPin3, OUTPUT);
  pinMode(echoPin3, INPUT);

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

  lidServo.attach(lidServoPin);  // Servo to control the open and close of the bin lid
  delay(100);
  armVerticalServo.attach(armVerticalServoPin);  // Servo to control the vertical rotation of the arm
  delay(100);
  armHorizontalServo.attach(armHorizontalServoPin);  // Servo to control the horizontal rotation of the arm
  delay(100);
  cover1Servo.attach(cover1ServoPin1);
  delay(100);
  cover2Servo.attach(cover2ServoPin2);
  delay(100);
  cover3Servo.attach(cover3ServoPin3);
  delay(100);

  // Set initial positions for servos
  lidServo.write(0);
  armVerticalServo.write(90);  // Angle go higher to throw
  armHorizontalServo.write(52);
  cover1Servo.write(9);
  cover2Servo.write(0);
  cover3Servo.write(87);

  SPI.begin();  // SCK=18, MISO=19, MOSI=23 by default for ESP32
  rfid.PCD_Init();

  for (int i = 0; i < 6; i++) {
    key.keyByte[i] = 0xFF;
  }

  Serial.begin(115200);

  // Print the local IP address
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());

  server.on("/segregationData", HTTP_POST, handlePost);
  server.begin();
}

void loop() {
  checkRFID();
  server.handleClient();

  int sensorState = digitalRead(irPin);

  if (sensorState == LOW) {
    if (binstatus) {
      lidServo.write(90);
      isInitial = false;

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
  } else if (sensorState == HIGH) {
    if (isInitial) {
      lidServo.write(0);
      return;
    }

    lidServo.write(0);
    delay(2000);  // Final delay after lid fully closed

    if (!closed) {
      opened = false;

      armVerticalServo.write(105);  // Slightly rotate the vertical robotic arm to place the garbage under the camera
      if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;

        http.begin(serverUrl);                               // Specify destination
        http.addHeader("Content-Type", "application/json");  // Set content-type

        String data = "{\"binID\":" + String(binID) + ",\"binstatus\": \"closed\", \"acceptingIMG\": true}";
        http.POST(data);

        http.end();
      }
    }

    closed = true;
  }
}