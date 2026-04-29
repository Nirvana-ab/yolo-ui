# YOLO Traffic Tracking Backend

这个后端给前端提供两个接口：

- `POST /api/detect`：图片单帧检测，返回 `detections`。
- `POST /api/track`：视频目标追踪，返回 `tracks`，包含 `track_id`、`bbox`、`center`、`trajectory`、`speed`、`direction`。

## 启动

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

首次运行会自动下载 `yolov8n.pt`。如果你有自己训练的交通模型，可以把 `main.py` 里的 `YOLO("yolov8n.pt")` 改成你的权重路径。

## 返回示例

```json
{
  "status": "success",
  "data": {
    "tracks": [
      {
        "track_id": 7,
        "class_name": "car",
        "confidence": 0.91,
        "bbox": [420, 300, 560, 410],
        "center": [490, 355],
        "trajectory": [[380, 340], [420, 346], [490, 355]],
        "direction": "由左向右",
        "speed": 31.5
      }
    ],
    "img_width": 1920,
    "img_height": 1080,
    "frame_count": 128,
    "fps": 25
  }
}
```

`speed` 当前是像素速度 `px/s`。如果要换算成真实 `km/h`，需要摄像头标定或透视变换。
