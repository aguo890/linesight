from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class BundleEventType(str, Enum):
    BUNDLE_STARTED = "BUNDLE_STARTED"
    PART_COUNTED = "PART_COUNTED"
    BUNDLE_COMPLETED = "BUNDLE_COMPLETED"

class TelemetryEvent(BaseModel):
    event_type: BundleEventType
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    device_id: str
    part_count: int = 0
    fraud_suspected: bool = False
    fraud_reason: Optional[str] = None
