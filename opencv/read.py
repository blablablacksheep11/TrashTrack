from ultralytics import YOLO
import cv2
import torch

# Check if CUDA (GPU) is available and set device
device = "cuda" if torch.cuda.is_available() else "cpu"

# Load pre-trained YOLOv8 model and move to device (GPU or CPU)
model = YOLO("yolo11n.pt").to(device)

# Open webcam
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Resize frame to reduce load (optional)
    frame = cv2.flip(frame, 1)  # Flip the frame horizontally
    frame_resized = cv2.resize(frame, (640, 480))  # Resize to a lower resolution for faster processing

    # Convert frame to a tensor and move it to GPU (if available)
    frame_tensor = torch.from_numpy(frame_resized).permute(2, 0, 1).float() / 255.0  # Normalize to [0,1]
    frame_tensor = frame_tensor.unsqueeze(0).to(device)


    # Run the model on the frame (GPU inference)
    results = model(frame_tensor)[0]  # Perform inference on the GPU

    height, width = frame.shape[:2]
    center_x, center_y = width // 2, height // 2

    closest_box = None
    closest_distance = float("inf")
    chosen_conf = 0
    chosen_label = ""

    for box in results.boxes:
        cls_id = int(box.cls)
        label = model.names[cls_id]

        if label == "person":
            continue  # Skip humans

        conf = box.conf.item()
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        box_center_x = (x1 + x2) // 2
        box_center_y = (y1 + y2) // 2

        # Distance from box center to frame center
        dist = ((box_center_x - center_x) ** 2 + (box_center_y - center_y) ** 2) ** 0.5

        if dist < closest_distance:
            closest_distance = dist
            closest_box = (x1, y1, x2, y2)
            chosen_conf = conf
            chosen_label = label

    annotated = frame.copy()

    if closest_box:
        x1, y1, x2, y2 = closest_box
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(annotated, f"{chosen_label} {chosen_conf:.2f}", (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    # Display the annotated frame
    cv2.imshow("YOLOv8 - Closest Non-Human Object", annotated)

    # Quit on pressing 'q'
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
