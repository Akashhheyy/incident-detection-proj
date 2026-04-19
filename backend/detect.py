import threading
import time
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Dict, Generator, Optional, Tuple

import cv2
import numpy as np
from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool
from starlette.responses import StreamingResponse
from ultralytics import YOLO

from database import get_alerts_collection


class DetectionError(Exception):
    """Raised when there is a problem with the detection engine."""


# --- Incident classification (readable policy) --------------------------------
# NORMAL: expected scene content (e.g. people going about normal activity).
# THREAT: weapon-like objects — persisted as alerts.
# IGNORE: everything else — not drawn and not logged (keeps UI clean and CPU low).
#
# Optional SUSPICIOUS_MOTION: lightweight OpenCV proxy for rapid physical activity
# when people are present. This is NOT a dedicated fight classifier; it flags
# unusual motion for operator review only.


class IncidentKind(str, Enum):
    NORMAL = "normal"
    THREAT = "threat"
    IGNORE = "ignore"


def classify_label(label: str) -> IncidentKind:
    """
    Map a YOLO class name to incident kind.
    Person → normal surveillance subject; knife/weapon-like → threat; else ignore.
    """
    name = (label or "").strip().lower()
    if name == "person":
        return IncidentKind.NORMAL
    if _is_weapon_label(name):
        return IncidentKind.THREAT
    return IncidentKind.IGNORE


def _is_weapon_label(name: str) -> bool:
    """True if the class name refers to a knife or similar edged weapon."""
    if not name:
        return False
    # Common custom-dataset names; extend if your weights use different labels.
    keywords = ("knife", "knives", "dagger", "blade", "machete")
    return name in keywords or any(k in name for k in ("knife", "dagger", "blade"))


def _resolve_model_weights() -> str:
    """
    Use the official YOLOv8n COCO pretrained weights so class index 0 is "person"
    and names match Ultralytics docs. Local checkpoints (e.g. best.pt) often use a
    different class map and will miss or mislabel "person" — do not auto-switch to them.
    """
    return "yolov8n.pt"


def _class_name_from_id(names: object, cls_id: int) -> str:
    """
    Map YOLO class index to string label. Ultralytics uses dict[int,str]; some exports
    use list-like ordering matching COCO indices.
    """
    if isinstance(names, dict):
        label = names.get(cls_id)
        if label is None:
            label = names.get(str(cls_id))
        return str(label).strip() if label is not None else str(cls_id)
    if isinstance(names, (list, tuple)) and 0 <= cls_id < len(names):
        return str(names[cls_id]).strip()
    return str(cls_id)


# BGR colors for OpenCV (explicit values requested)
_COLOR_NORMAL = (0, 255, 0)  # green — person / normal
_COLOR_THREAT = (0, 0, 255)  # red — knife alert
_COLOR_TEXT_BG = (40, 40, 40)
_COLOR_STATUS_OK = (50, 120, 50)
_COLOR_STATUS_ALERT = (50, 50, 180)
_COLOR_STATUS_WARN = (50, 160, 220)
_COLOR_STATUS_IDLE = (70, 70, 70)


class YoloDetector:
    """
    YOLOv8-based detector that powers both the video stream and alert generation.

    Detection work runs in a dedicated background thread to keep the HTTP
    response loop responsive.
    """

    def __init__(self, camera_index: int = 0, min_confidence: float = 0.45) -> None:
        self.camera_index = camera_index
        # ~0.4–0.5 improves recall for "person" on webcam; too high misses valid boxes.
        self.min_confidence = min_confidence
        weights = _resolve_model_weights()
        self.model = YOLO(weights)

        self.capture = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
        if not self.capture.isOpened():
            raise DetectionError("Unable to open camera. Ensure a webcam is connected.")

        self.alerts_collection = get_alerts_collection()
        self.alerts_enabled = False

        # Motion heuristic state (single worker thread — no extra locking needed)
        self._prev_gray_small: Optional[np.ndarray] = None
        self._motion_score: float = 0.0
        # Mean absolute diff threshold on downscaled grayscale (tunable for your camera)
        self._motion_alert_threshold: float = 28.0

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
        # Avoid one spurious motion spike after toggling detection on.
        self._prev_gray_small = None
        self._motion_score = 0.0

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

    def _cooldown_ok(self, key: str, now: datetime, seconds: float) -> bool:
        last = self._last_alert_times.get(key)
        if last and (now - last) < timedelta(seconds=seconds):
            return False
        return True

    def _try_insert_alert(
        self, alert_type: str, confidence: float, now: datetime, cooldown: float
    ) -> None:
        if not self._cooldown_ok(alert_type, now, cooldown):
            return
        alert_doc = {
            "alert_type": alert_type,
            "confidence": float(confidence),
            "timestamp": now,
            "camera_id": "CAM-1",
        }
        try:
            self.alerts_collection.insert_one(alert_doc)
            self._last_alert_times[alert_type] = now
        except Exception:
            pass

    @staticmethod
    def _draw_label_pill(
        frame: np.ndarray,
        x1: int,
        y1: int,
        text: str,
        fg_bgr: Tuple[int, int, int],
        bg_bgr: Tuple[int, int, int],
    ) -> None:
        """Readable label with solid background strip above the box top edge."""
        font = cv2.FONT_HERSHEY_SIMPLEX
        scale = 0.55
        thickness = 2
        (tw, th), baseline = cv2.getTextSize(text, font, scale, thickness)
        pad_x, pad_y = 6, 4
        y_text_top = max(y1 - th - pad_y * 2, 0)
        y_text_bottom = y1
        x2 = min(x1 + tw + pad_x * 2, frame.shape[1] - 1)
        cv2.rectangle(
            frame,
            (x1, y_text_top),
            (x2, y_text_bottom),
            bg_bgr,
            thickness=-1,
            lineType=cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            text,
            (x1 + pad_x, y_text_bottom - pad_y),
            font,
            scale,
            fg_bgr,
            thickness,
            cv2.LINE_AA,
        )

    @staticmethod
    def _draw_box(
        frame: np.ndarray,
        x1: int,
        y1: int,
        x2: int,
        y2: int,
        color_bgr: Tuple[int, int, int],
    ) -> None:
        cv2.rectangle(frame, (x1, y1), (x2, y2), color_bgr, 2, lineType=cv2.LINE_AA)

    def _update_motion_score(self, frame: np.ndarray) -> float:
        """
        Cheap frame-difference score for rapid movement (proxy for scuffles).
        Uses a small grayscale copy for speed.
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(gray, (320, 180), interpolation=cv2.INTER_AREA)
        if self._prev_gray_small is None:
            self._prev_gray_small = small
            self._motion_score = 0.0
            return 0.0
        diff = cv2.absdiff(small, self._prev_gray_small)
        score = float(np.mean(diff))
        self._motion_score = score
        self._prev_gray_small = small
        return score

    def _draw_status_strip(
        self,
        frame: np.ndarray,
        *,
        detection_on: bool,
        scene_state: str,
        detail: str,
    ) -> None:
        """Top banner so operators see mode and scene classification at a glance."""
        h, w = frame.shape[:2]
        bar_h = 52
        if scene_state == "alert":
            bg = _COLOR_STATUS_ALERT
        elif scene_state == "suspicious":
            bg = _COLOR_STATUS_WARN
        elif scene_state == "standby":
            bg = _COLOR_STATUS_IDLE
        else:
            bg = _COLOR_STATUS_OK

        cv2.rectangle(frame, (0, 0), (w, bar_h), bg, -1, cv2.LINE_AA)

        line1 = (
            f"AI DETECTION: {'ON' if detection_on else 'OFF'}  |  "
            f"Scene: {scene_state.upper()}"
        )
        cv2.putText(
            frame,
            line1,
            (10, 22),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame,
            detail[:120],
            (10, 44),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (230, 230, 230),
            1,
            cv2.LINE_AA,
        )

    def _process_frame_and_log_alerts(self, frame: np.ndarray) -> None:
        """Run YOLO, classify incidents, draw overlays, and persist high-risk events."""
        # BGR uint8 numpy frame (OpenCV) — expected by Ultralytics predict
        results = self.model(
            frame,
            conf=self.min_confidence,
            verbose=False,
        )
        now = datetime.now(timezone.utc)

        motion = self._update_motion_score(frame)
        person_count = 0
        has_threat = False

        for result in results:
            boxes = result.boxes
            names = result.names if hasattr(result, "names") else self.model.names
            if boxes is None or len(boxes) == 0:
                continue

            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                label = _class_name_from_id(names, cls_id)
                if conf < self.min_confidence:
                    continue

                kind = classify_label(label)
                if kind is IncidentKind.IGNORE:
                    continue

                x1, y1, x2, y2 = map(int, box.xyxy[0])

                if kind is IncidentKind.NORMAL:
                    person_count += 1
                    self._draw_box(frame, x1, y1, x2, y2, _COLOR_NORMAL)
                    self._draw_label_pill(
                        frame,
                        x1,
                        y1,
                        "PERSON - NORMAL",
                        (255, 255, 255),
                        _COLOR_TEXT_BG,
                    )
                    continue

                if kind is IncidentKind.THREAT:
                    has_threat = True
                    self._try_insert_alert("knife", conf, now, cooldown=5.0)
                    self._draw_box(frame, x1, y1, x2, y2, _COLOR_THREAT)
                    self._draw_label_pill(
                        frame,
                        x1,
                        y1,
                        "ALERT: KNIFE",
                        (255, 255, 255),
                        (30, 30, 160),
                    )

        # Suspicious motion: people present, no confirmed weapon box this frame,
        # and abrupt global motion — logged sparingly.
        suspicious_motion = (
            person_count >= 1
            and not has_threat
            and motion >= self._motion_alert_threshold
        )
        if suspicious_motion:
            norm_conf = min(max(motion / 100.0, 0.0), 1.0)
            self._try_insert_alert(
                "suspicious_motion", norm_conf, now, cooldown=8.0
            )

        if has_threat:
            scene_state = "alert"
            detail = "Weapon-like object reported — check feed immediately."
        elif suspicious_motion:
            scene_state = "suspicious"
            detail = (
                f"Elevated motion ({motion:.1f}) with people in view — verify activity."
            )
        else:
            scene_state = "normal"
            detail = (
                f"Persons in view: {person_count}  |  Motion index: {motion:.1f}"
            )

        self._draw_status_strip(
            frame,
            detection_on=True,
            scene_state=scene_state,
            detail=detail,
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
            else:
                # Standby: show that the stream is live without running the model.
                self._draw_status_strip(
                    frame,
                    detection_on=False,
                    scene_state="standby",
                    detail="Start detection to enable AI overlays and incident logging.",
                )

            success, buffer = cv2.imencode(".jpg", frame)
            if success:
                self._set_latest_frame(buffer.tobytes())

            time.sleep(0.03)

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
