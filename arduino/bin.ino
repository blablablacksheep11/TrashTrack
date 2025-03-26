#include <Servo.h>
#include <SPI.h>
#include <MFRC522.h>

#define binID 1
#define irPin 2
#define trigPin 3
#define echoPin 4
#define servoPin 5
#define redledPin 6
#define greenledPin 7
#define RST_PIN 9
#define SS_PIN 10

MFRC522 rfid(SS_PIN, RST_PIN);
MFRC522::MIFARE_Key key;

bool opened = false;
bool closed = false;
bool status = true;
double duration, distance, accumulation;
unsigned long lastCheckTime = 0;
const long checkInterval = 1;
Servo myServo;

void setup()
{
  pinMode(greenledPin, OUTPUT);
  pinMode(redledPin, OUTPUT);
  pinMode(irPin, INPUT);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  myServo.attach(servoPin);
  myServo.write(0);
  SPI.begin();
  rfid.PCD_Init();

  for (int i = 0; i < 6; i++)
  {
    key.keyByte[i] = 0xFF;
  }

  Serial.begin(9600);
}

void loop()
{
  checkRFID();
  if (accumulation >= 80)
  {
    digitalWrite(redledPin, HIGH);
    digitalWrite(greenledPin, LOW);
    return;
  }
  else
  {
    digitalWrite(redledPin, LOW);
    digitalWrite(greenledPin, HIGH);
  }
  int sensorState = digitalRead(irPin);

  if (sensorState == LOW)
  {
    if (status == true)
    {
      myServo.write(100);
      if (opened == false)
      {
        closed = false;
        Serial.print(F("{\"binID\":"));
        Serial.print(binID);
        Serial.println(F(",\"status\": \"opened\"}"));
        opened = true;
      }
      delay(1000);
    }
    else
    {
      closed = false;
      opened = true;
      return;
    }
  }
  else
  {
    myServo.write(0);
    delay(2000);
    if (closed == false)
    {
      opened = false;
      digitalWrite(trigPin, LOW);
      delayMicroseconds(10);
      digitalWrite(trigPin, HIGH);
      delayMicroseconds(10);
      digitalWrite(trigPin, LOW);

      duration = pulseIn(echoPin, HIGH);
      distance = (duration * 0.034) / 2;
      accumulation = 100 - ((distance / 24) * 100);
      if (accumulation >= 80)
      {
        digitalWrite(redledPin, HIGH);
        digitalWrite(greenledPin, LOW);
        status = false;
      }
      else
      {
        digitalWrite(redledPin, LOW);
        digitalWrite(greenledPin, HIGH);
        status = true;
      }

      if (distance <= 0)
      {
        distance = 0;
      }
      else if (distance >= 24)
      {
        distance = 24;
      }
      Serial.print(F("{\"binID\":"));
      Serial.print(binID);
      Serial.print(F(",\"status\": \"closed\", \"distance\": "));
      Serial.print(distance);
      Serial.println(F("}"));
      closed = true;
    }
  }
}

void checkRFID()
{
  if (millis() - lastCheckTime >= checkInterval)
  {
    lastCheckTime = millis();

    if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial())
    {
      return;
    }

    digitalWrite(redledPin, LOW);
    digitalWrite(greenledPin, HIGH);
    accumulation = 0;
    status = true;
    byte buffer[18];
    byte buffersize = sizeof(buffer);
    String fields[] = {"cleanerID", "Name"};

    byte status;
    byte block = 1;
    int startingblock;
    int trailerblock;
    int counter = 0;
    int fieldCount = 2;
    String jsonOutput = "{\"binid\": " + String(binID) + ", ";

    for (byte i = 0; i < fieldCount; i++)
    {
      startingblock = block / 4 * 4;
      trailerblock = startingblock + 3;

      status = rfid.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, trailerblock, &key, &(rfid.uid));
      if (status != MFRC522::STATUS_OK)
      {
        Serial.print("Authorization failed: ");
        Serial.println(rfid.GetStatusCodeName(status));
        return;
      }

      if (block == trailerblock)
      {
        fieldCount += 1;
      }
      else
      {
        status = rfid.MIFARE_Read(block, buffer, &buffersize);
        if (status == MFRC522::STATUS_OK)
        {
          jsonOutput += "\"" + fields[counter] + "\": \"";

          for (byte j = 0; j < 16; j++)
          {
            if (buffer[j] != 0x00)
            { // Ignore null bytes
              jsonOutput += (char)buffer[j];
            }
          }

          jsonOutput += "\"";
          if (counter < fieldCount - 1)
          {
            jsonOutput += ", ";
          }
        }
        else
        {
          Serial.print("Read failed: ");
          Serial.println(rfid.GetStatusCodeName(status));
        }
        counter++;
      }
      block++;
    }

    jsonOutput += "}";

    // Send properly formatted JSON
    Serial.println(jsonOutput);

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }
}
