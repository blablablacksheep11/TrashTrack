#include <SPI.h>
#include <MFRC522.h>

#define sspin 10
#define rstpin 9
MFRC522 rfid(sspin, rstpin);
MFRC522::MIFARE_Key key;

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("Place your card");

  for (int i = 0; i < 6; i++) {
    key.keyByte[i] = 0xFF;
  }
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  Serial.println("Card detected");

  byte block = 1;
  byte data1[16] = { "1" };
  byte data2[16] = { "John Carter" };
  byte data3[16] = { "male" };
  byte* data[] = { data1, data2, data3};

  byte status;
  int startingblock;
  int trailerblock;
  int counter = 0;
  int size = (sizeof(data) / sizeof(data[0]));

  for (byte i = 0; i < size; i++) {
    startingblock = block / 4 * 4;
    trailerblock = startingblock + 3;

    status = rfid.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, trailerblock, &key, &(rfid.uid));
    if (status != MFRC522::STATUS_OK) {
      Serial.print("Authorization failed: ");
      Serial.println(rfid.GetStatusCodeName(status));
      return;
    }

    if (block == trailerblock) {
      Serial.print("Skipping writing trailer block ");
      Serial.println(block);
      size += 1;
    } else {
      status = rfid.MIFARE_Write(block, data[counter], 16);
      if (status == MFRC522::STATUS_OK) {
        Serial.print("Data ");
        Serial.print(i + 1);
        Serial.println(" write successful");
      } else {
        Serial.print("Write failed: ");
        Serial.println(rfid.GetStatusCodeName(status));
      }
      counter++;
    }
    block++;
  }

  Serial.println("Write complete!!!");

  //rfid.PICC_DumpToSerial(&(rfid.uid));
  rfid.PICC_HaltA();       // Halt the card
  rfid.PCD_StopCrypto1();  // Stop encryption

  delay(5000);
}