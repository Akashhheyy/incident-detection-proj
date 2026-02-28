from datetime import datetime
from typing import Any, Dict, Optional

from bson import ObjectId
from pydantic import BaseModel, Field


class AlertBase(BaseModel):
    alert_type: str
    confidence: float
    timestamp: datetime
    camera_id: str


class Alert(AlertBase):
    id: Optional[str] = Field(default=None, alias="_id")

    class Config:
        populate_by_name = True
        orm_mode = True


def serialize_mongo_alert(doc: Dict[str, Any]) -> Alert:
    """Convert a MongoDB document into an Alert model."""
    alert_id = doc.get("_id")
    if isinstance(alert_id, ObjectId):
        doc["_id"] = str(alert_id)
    return Alert(**doc)
