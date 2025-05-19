import cv2 as cv

video = cv.VideoCapture(0) # Open the camera
while True:
    ret, frame = video.read() # Read the video as a frame, smth like a snapshot
    if not ret:
        break

    frame = cv.flip(frame, 1) # Flip the frame horizontally
    cv.imshow("Video", frame) # Show the video
    if cv.waitKey(1) & 0xFF == ord('q'): # Press 'q' to exit
        break