from ultralytics import YOLO
import cv2
import torch
import base64
import requests
import time

# Setup
device = "cuda" if torch.cuda.is_available() else "cpu"
model = YOLO("yolo11s.pt").to(device)
cap = cv2.VideoCapture(0)

captured_object = None
capture_threshold = 50  # pixels of allowable movement
last_capture_time = 0
center_margin = 50  # size of central region around center_x, center_y


while True:
    try:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        frame_resized = cv2.resize(frame, (640, 480))
        frame_tensor = torch.from_numpy(frame_resized).permute(2, 0, 1).float() / 255.0
        frame_tensor = frame_tensor.unsqueeze(0).to(device)

        results = model(frame_tensor)[0]
        height, width = frame.shape[:2]
        center_x, center_y = width // 2, height // 2

        closest_box = None
        closest_distance = float("inf")
        chosen_conf = 0
        chosen_label = ""
        box_center = (0, 0)

        for box in results.boxes:
            cls_id = int(box.cls)
            label = model.names[cls_id]
            if label == "person":
                continue

            conf = box.conf.item()
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            box_center_x = (x1 + x2) // 2
            box_center_y = (y1 + y2) // 2

            # Check if center of the object is within the center box
            if (abs(box_center_x - center_x) <= center_margin and
                abs(box_center_y - center_y) <= center_margin):

                # This object is in the center zone — focus on it
                closest_box = (x1, y1, x2, y2)
                chosen_conf = conf
                chosen_label = label
                box_center = (box_center_x, box_center_y)
                break  # Only pick first valid one in center


        annotated = frame.copy()

        if closest_box:
            x1, y1, x2, y2 = closest_box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(annotated, f"{chosen_label} {chosen_conf:.2f}", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

            # Only capture/send image if the object moves significantly from the previous
            """if captured_object is None:
                should_capture = True
            else:
                prev_x, prev_y = captured_object
                movement = ((box_center[0] - prev_x) ** 2 + (box_center[1] - prev_y) ** 2) ** 0.5
                should_capture = movement > capture_threshold

            if should_capture:
                cropped = frame[y1:y2, x1:x2]
                _, buffer = cv2.imencode('.jpg', cropped)
                img_base64 = base64.b64encode(buffer).decode('utf-8')

                data = {
                    "label": chosen_label,
                    "confidence": chosen_conf,
                    "image": img_base64
                }

                url = "http://localhost:3000/img"

                try:
                    response = requests.post(url, json=data)
                    print("[INFO] Sent image to server:", response.status_code, response.text)
                    captured_object = box_center  # Update only after successful capture
                except Exception as e:
                    print("[ERROR] Could not send image:", e)"""

        # Display result
        cv2.imshow("YOLOv8 - Center Focused Object", annotated)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    except Exception as e:
        print("[ERROR] Main loop error:", e)

cap.release()
cv2.destroyAllWindows()
