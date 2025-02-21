#include <Servo.h>

#define irPin 2
#define servoPin 9
#define trigPin 3
#define echoPin 4
#define binID 1

bool opened = false;
bool closed = false;
double duration, distance, accumulation;
Servo myServo;

void setup() {
  pinMode(irPin, INPUT);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  myServo.attach(servoPin);
  myServo.write(0);
  Serial.begin(9600);
}

void loop() {
  int sensorState = digitalRead(irPin);

  if (sensorState == LOW) {
    myServo.write(75);
    if (opened == false) {
      closed = false;
      Serial.print(F("{\"binID\":"));
      Serial.print(binID);
      Serial.println(F(",\"status\": \"opened\"}"));
      opened = true;
    }
    delay(1000);
  } else {
    myServo.write(0);
    delay(2000);
    if (closed == false) {
      opened = false;
      digitalWrite(trigPin, LOW);
      delayMicroseconds(2);
      digitalWrite(trigPin, HIGH);
      delayMicroseconds(10);
      digitalWrite(trigPin, LOW);

      duration = pulseIn(echoPin, HIGH);
      distance = (duration * 0.034) / 2;

      accumulation = 100 - ((distance / 13) * 100);
      if(accumulation <= 0){
        accumulation = 0;
      }
      Serial.print(F("{\"binID\":"));
      Serial.print(binID);
      Serial.print(F(",\"status\": \"closed\", \"accumulation\": \""));
      Serial.print(accumulation);
      Serial.println(F("%\"}"));
      closed = true;
    }
  }
}