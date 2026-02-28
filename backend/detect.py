import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Generator, List, Optional

import cv2
from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool
from starlette.responses import StreamingResponse
from ultralytics import YOLO

from database import get_alerts_collection


class DetectionError(Exception):
    """Raised when there is a problem with the detection engine."""


class YoloDetector:
    """
    YOLOv8-based detector that powers both the video stream and alert generation.

    Detection work runs in a dedicated background thread to keep the HTTP
    response loop responsive.
    """

    def __init__(self, camera_index: int = 0, min_confidence: float = 0.6) -> None:
        self.camera_index = camera_index
        self.min_confidence = min_confidence
        self.model = YOLO("yolov8n.pt")

        self.capture = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
        if not self.capture.isOpened():
            raise DetectionError("Unable to open camera. Ensure a webcam is connected.")

        self.alerts_collection = get_alerts_collection()
        # Map class names we care about
        self.target_classes: List[str] = ["person", "knife"]
        self.alerts_enabled = False

        # Background worker control
        self._lock = threading.Lock()
        self._stop_worker = False
        self._latest_frame_bytes: Optional[bytes] = None
        self._last_alert_times: Dict[str, datetime] = {}
        self._worker_thread = threading.Thread(
            target=self._worker_loop, daemon=True
        )
        self._worker_thread.start()

    def _open_capture_if_needed(self) -> None:
        if self.capture is None or not self.capture.isOpened():
            self.capture = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)

    def start_detection(self) -> None:
        """Enable alert detection. The worker thread reads this flag."""
        with self._lock:
            self.alerts_enabled = True

    def stop_detection(self) -> None:
        """Disable alert detection."""
        with self._lock:
            self.alerts_enabled = False

    def release(self) -> None:
        """Stop worker and release camera resources safely."""
        with self._lock:
            self._stop_worker = True

        if self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2.0)

        with self._lock:
            if self.capture is not None and self.capture.isOpened():
                self.capture.release()

    def _should_detect(self) -> bool:
        with self._lock:
            return self.alerts_enabled

    def _set_latest_frame(self, frame_bytes: bytes) -> None:
        with self._lock:
            self._latest_frame_bytes = frame_bytes

    def _get_latest_frame(self) -> Optional[bytes]:
        with self._lock:
            return self._latest_frame_bytes

    def _process_frame_and_log_alerts(self, frame) -> None:
        """Run YOLO on the frame and persist any abnormal detections."""
        results = self.model(frame, verbose=False)
        now = datetime.now(timezone.utc)

        for result in results:
            boxes = result.boxes
            names = result.names if hasattr(result, "names") else self.model.names
            if boxes is None:
                continue

            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                label = names.get(cls_id, str(cls_id))

                if label in self.target_classes and conf >= self.min_confidence:
                    # Simple cooldown to avoid spamming the same alert type
                    last_time = self._last_alert_times.get(label)
                    if last_time and (now - last_time) < timedelta(seconds=5):
                        # Still draw overlays but skip DB write
                        pass
                    else:
                        alert_doc = {
                            "alert_type": label,
                            "confidence": conf,
                            "timestamp": now,
                            "camera_id": "CAM-1",
                        }
                        try:
                            self.alerts_collection.insert_one(alert_doc)
                            self._last_alert_times[label] = now
                        except Exception:
                            # For robustness, ignore DB errors during streaming
                            pass

                    # Draw bounding box and label on the frame
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    label_text = f"{label}: {conf:.2f}"
                    cv2.putText(
                        frame,
                        label_text,
                        (x1, max(y1 - 10, 0)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (0, 0, 255),
                        2,
                    )

    def _worker_loop(self) -> None:
        """
        Background worker that reads frames, runs detection, and keeps
        the latest encoded JPEG available for HTTP streaming.
        """
        while True:
            with self._lock:
                if self._stop_worker:
                    break

            self._open_capture_if_needed()
            if self.capture is None or not self.capture.isOpened():
                time.sleep(1.0)
                continue

            success, frame = self.capture.read()
            if not success:
                time.sleep(0.1)
                continue

            if self._should_detect():
                self._process_frame_and_log_alerts(frame)

            success, buffer = cv2.imencode(".jpg", frame)
            if success:
                self._set_latest_frame(buffer.tobytes())

            # Limit loop speed a bit to avoid pegging CPU
            time.sleep(0.03)

        # On exit, release resources safely
        with self._lock:
            if self.capture is not None and self.capture.isOpened():
                self.capture.release()

    def frame_generator(self) -> Generator[bytes, None, None]:
        """
        Generator yielding JPEG frames in multipart format for StreamingResponse.
        Uses frames produced by the background worker thread.
        """
        while True:
            with self._lock:
                if self._stop_worker:
                    break

            frame_bytes = self._get_latest_frame()
            if frame_bytes is None:
                # Wait for the worker to produce the first frame
                time.sleep(0.1)
                continue

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
            )
            time.sleep(0.03)


detector: YoloDetector | None = None
_detector_lock = threading.Lock()


def get_detector() -> YoloDetector:
    """Return a singleton instance of the detector."""
    global detector
    with _detector_lock:
        if detector is None:
            detector = YoloDetector()
        return detector


def get_video_streaming_response() -> StreamingResponse:
    """
    Helper to build a StreamingResponse for the live video feed.
    """
    try:
        active_detector = get_detector()
    except DetectionError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return StreamingResponse(
        active_detector.frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


async def enable_detection_async() -> None:
    """
    Async-friendly wrapper to enable detection in a background thread.
    """
    await run_in_threadpool(get_detector().start_detection)


async def disable_detection_async() -> None:
    """
    Async-friendly wrapper to disable detection.
    """
    await run_in_threadpool(get_detector().stop_detection)

