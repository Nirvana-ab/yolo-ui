from collections import defaultdict, deque
from math import hypot
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Deque

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO


VEHICLE_CLASSES = [2, 3, 5, 7]  # COCO: car, motorcycle, bus, truck
MAX_TRAJECTORY_POINTS = 80
MAX_VIDEO_FRAMES = 600

app = FastAPI(title="YOLO Traffic Tracking API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO("yolov8n.pt")


@app.get("/api/health")
def health():
    return {"status": "success", "message": "traffic tracking backend is running"}


@app.post("/api/detect")
async def detect_image(file: UploadFile = File(...), conf: float = Form(0.25)):
    image_bytes = await file.read()
    image_array = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)

    if image_array is None:
        return {"status": "error", "message": "无法读取图片"}

    height, width = image_array.shape[:2]
    results = model.predict(image_array, conf=conf, classes=VEHICLE_CLASSES, verbose=False)
    detections = []

    for box in results[0].boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        cls_id = int(box.cls[0])
        detections.append(
            {
                "class_name": model.names[cls_id],
                "confidence": float(box.conf[0]),
                "bbox": [x1, y1, x2, y2],
            }
        )

    return {
        "status": "success",
        "data": {
            "detections": detections,
            "img_width": width,
            "img_height": height,
        },
    }


@app.post("/api/track")
async def track_video(file: UploadFile = File(...), conf: float = Form(0.25)):
    suffix = Path(file.filename or "upload.mp4").suffix or ".mp4"

    with NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
        tmp_file.write(await file.read())
        video_path = tmp_file.name

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        Path(video_path).unlink(missing_ok=True)
        return {"status": "error", "message": "无法读取视频"}

    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1)
    track_history: dict[int, Deque[list[float]]] = defaultdict(
        lambda: deque(maxlen=MAX_TRAJECTORY_POINTS)
    )
    latest_tracks = {}
    frame_index = 0

    while frame_index < MAX_VIDEO_FRAMES:
        ok, frame = cap.read()
        if not ok:
            break

        frame_index += 1
        results = model.track(
            frame,
            persist=True,
            tracker="bytetrack.yaml",
            conf=conf,
            classes=VEHICLE_CLASSES,
            verbose=False,
        )

        boxes = results[0].boxes
        if boxes.id is None:
            continue

        for box in boxes:
            if box.id is None:
                continue

            track_id = int(box.id[0])
            cls_id = int(box.cls[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2
            history = track_history[track_id]
            history.append([cx, cy])

            latest_tracks[track_id] = {
                "track_id": track_id,
                "class_name": model.names[cls_id],
                "confidence": float(box.conf[0]),
                "bbox": [x1, y1, x2, y2],
                "center": [cx, cy],
                "trajectory": list(history),
                "direction": calc_direction(history),
                "speed": calc_speed_px_per_second(history, fps),
            }

    cap.release()
    Path(video_path).unlink(missing_ok=True)

    tracks = sorted(latest_tracks.values(), key=lambda item: item["track_id"])
    return {
        "status": "success",
        "data": {
            "tracks": tracks,
            "img_width": width,
            "img_height": height,
            "frame_count": frame_index,
            "fps": fps,
        },
    }


def calc_direction(points: Deque[list[float]]) -> str:
    if len(points) < 2:
        return "未知"

    start_x, start_y = points[0]
    end_x, end_y = points[-1]
    dx = end_x - start_x
    dy = end_y - start_y

    if abs(dx) > abs(dy):
        return "由左向右" if dx > 0 else "由右向左"
    return "由上向下" if dy > 0 else "由下向上"


def calc_speed_px_per_second(points: Deque[list[float]], fps: float) -> float:
    if len(points) < 2:
        return 0

    total_distance = 0.0
    previous = points[0]
    for current in list(points)[1:]:
        total_distance += hypot(current[0] - previous[0], current[1] - previous[1])
        previous = current

    seconds = max((len(points) - 1) / fps, 1 / fps)
    return total_distance / seconds
