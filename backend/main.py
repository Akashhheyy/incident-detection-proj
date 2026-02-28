from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from alert import Alert, serialize_mongo_alert
from database import close_mongo_client, get_alerts_collection
from detect import (
    disable_detection_async,
    enable_detection_async,
    get_detector,
    get_video_streaming_response,
)


app = FastAPI(title="AI Surveillance System", version="1.0.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    # Initialize detector on startup so camera / model issues surface early.
    get_detector()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    # Release camera and Mongo resources gracefully.
    try:
        get_detector().release()
    except Exception:
        pass
    close_mongo_client()


@app.get("/health")
async def health_check() -> dict:
    return {"status": 200, "message": "OK"}


@app.get("/video_feed")
async def video_feed():
    """
    Live video stream from the server's webcam.
    Frontend should use this endpoint as
    <img src="http://127.0.0.1:8000/video_feed" />.
    """
    return get_video_streaming_response()


@app.get("/alerts", response_model=List[Alert])
async def get_alerts(limit: int = 100) -> List[Alert]:
    """
    Fetch recent alerts from MongoDB.
    """
    collection = get_alerts_collection()
    cursor = collection.find().sort("timestamp", -1).limit(limit)
    alerts = [serialize_mongo_alert(doc) for doc in cursor]
    return alerts


@app.post("/start_detection")
async def start_detection() -> dict:
    """
    Enable YOLO-based detection on the live feed.
    Detection runs inside a background worker thread.
    """
    await enable_detection_async()
    return {"status": "detection_started"}


@app.post("/stop_detection")
async def stop_detection() -> dict:
    """
    Disable YOLO-based detection while keeping the live feed available.
    """
    await disable_detection_async()
    return {"status": "detection_stopped"}
