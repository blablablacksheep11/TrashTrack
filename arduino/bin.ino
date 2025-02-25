#include <Servo.h>

#define irPin 2
#define servoPin 9
#define trigPin 3
#define echoPin 4
#define binID 1

bool opened = false;
bool closed = false;
double duration, distance;
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
    delay(1000);
    if (closed == false) {
      opened = false;
      digitalWrite(trigPin, LOW);
      delayMicroseconds(10);
      digitalWrite(trigPin, HIGH);
      delayMicroseconds(10);
      digitalWrite(trigPin, LOW);

      duration = pulseIn(echoPin, HIGH);
      distance = (duration * 0.034) / 2;

      if(distance <= 0){
        distance = 0;
      } else if(distance >= 13){
        distance = 13;
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