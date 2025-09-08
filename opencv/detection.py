from ultralytics import YOLO
import cv2
import torch
import base64
import requests
import time

device = "cuda" if torch.cuda.is_available() else "cpu" # Use GPU if available, otherwise use CPU
model = YOLO("yolov8s.pt").to(device) # Load the YOLOv8 model to GPU/CPU
cap = cv2.VideoCapture(0) # Receive the video from the camera, the default port is 81

captured_object = None
capture_threshold = 50 # If the object moves more than this distance, it will be consider as new object
last_capture_time = 0
cooldown_seconds = 15 # Cooldown period in seconds
center_margin = 50 # The main frame will be 50 pixels around the center of the screen

while True:
    try:
        ret, frame = cap.read() # Read the video as a frame, smth like a snapshot
        if not ret:
            print("[ERROR] Failed to read frame from camera.")
            time.sleep(1) # Wait for a second before retrying
            continue

        frame = cv2.flip(frame, 1) # Flip the frame horizontally
        frame = cv2.resize(frame, (640, 480))
        frame_tensor = torch.from_numpy(frame).permute(2, 0, 1).float() / 255.0
        frame_tensor = frame_tensor.unsqueeze(0).to(device)

        results = model(frame_tensor)[0]
        height, width = frame.shape[:2]
        center_x, center_y = width // 2, height // 2 # Calculate the center of the frame

        closest_box = None
        closest_distance = float("inf")
        chosen_conf = 0
        chosen_label = ""
        box_center = (0, 0)
        
        # print(results.boxes)

        for box in results.boxes:
            cls_id = int(box.cls) # This returns the class id of the object, e.g. 0 for person
            label = model.names[cls_id] # This returns the class name of the object, e.g. "person"
            # Ignore the person class
            if label == "person":
                continue

            confidence = box.conf.item()
            x1, y1, x2, y2 = map(int, box.xyxy[0]) # Get the coordinates of the first object (the frame) beside human
            # Calculate the center of the bounding box
            box_center_x = (x1 + x2) // 2
            box_center_y = (y1 + y2) // 2

            # Check either the object is located at the center of the screen
            # Ensuring the object only be considered if it is in the center of the screen
            # Ensure the object only captured at expected area
            if (abs(box_center_x - center_x) <= center_margin and
                abs(box_center_y - center_y) <= center_margin):

                # This object is in the center zone — focus on it
                closest_box = (x1, y1, x2, y2)
                chosen_conf = confidence
                chosen_label = label
                box_center = (box_center_x, box_center_y)
                break  # Only pick first valid one in center

        annotated = frame.copy()

        if closest_box:
            x1, y1, x2, y2 = closest_box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2) # Draw the bounding box

            # If object not captured yet
            if captured_object is None:
                should_capture = True
            # If object captured
            else:
                prev_x, prev_y = captured_object # Ge the coordination of the last captured object
                movement = ((box_center[0] - prev_x) ** 2 + (box_center[1] - prev_y) ** 2) ** 0.5 # Check either the object moved or not
                should_capture = movement > capture_threshold

            current_time = time.time()
            if should_capture and (current_time - last_capture_time) >= cooldown_seconds:
                cropped = frame[y1:y2, x1:x2]
                _, buffer = cv2.imencode('.jpg', cropped)
                img_base64 = base64.b64encode(buffer).decode('utf-8') # Convert the cropped image to base64 string

                data = {
                    "label": chosen_label,
                    "confidence": chosen_conf,
                    "image": img_base64
                }

                url = "https://trashtrack-production.up.railway.app/cv/img" # The url of nodejs server, ../server/server.js

                try:
                    response = requests.post(url, json=data, timeout=10)
                    print("[INFO] Sent image to server:", response.status_code, response.text)
                    captured_object = box_center  # Update only after successful capture
                    last_capture_time = current_time  # Start cooldown
                except requests.exceptions.Timeout:
                    print("[ERROR] Request timed out.")
                except Exception as e:
                    print("[ERROR] Could not send image:", e)

        # Display result
        cv2.imshow("YOLOv8 - Center Focused Object", annotated)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    except Exception as e:
        print("[ERROR] Main loop error:", e)

cap.release()
cv2.destroyAllWindows()
