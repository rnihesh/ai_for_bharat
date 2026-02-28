"""
Short-term memory for Telegram bot
Stores pending image analysis for proactive confirmation flows
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Dict, Any


@dataclass
class ImageAnalysis:
    """Stores analysis result for a pending image"""
    image_url: str
    classification: Dict[str, Any]  # Result from classify endpoint
    description: Optional[str] = None
    issue_type: Optional[str] = None
    confidence: float = 0.0
    confirmed_for_report: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)

    def is_civic_issue(self) -> bool:
        """Check if the analysis detected a valid civic issue"""
        return self.classification.get("isValid", False) and not self.classification.get("isUnrelated", True)


@dataclass
class ShortTermMemory:
    """Per-user short-term memory for proactive flows"""
    pending_analysis: Optional[ImageAnalysis] = None
    detected_language: str = "en"
    last_activity: datetime = field(default_factory=datetime.utcnow)

    # Location data that might come before/after image
    pending_location: Optional[Dict[str, float]] = None
    pending_address: Optional[str] = None

    def store_analysis(self, analysis: ImageAnalysis) -> None:
        """Store a new image analysis"""
        self.pending_analysis = analysis
        self.last_activity = datetime.utcnow()

    def confirm_pending(self) -> Optional[ImageAnalysis]:
        """Mark pending analysis as confirmed and return it"""
        if self.pending_analysis:
            self.pending_analysis.confirmed_for_report = True
            self.last_activity = datetime.utcnow()
            return self.pending_analysis
        return None

    def clear_pending(self) -> None:
        """Clear pending analysis (user declined)"""
        self.pending_analysis = None
        self.last_activity = datetime.utcnow()

    def store_location(self, lat: float, lng: float, address: Optional[str] = None) -> None:
        """Store location data"""
        self.pending_location = {"lat": lat, "lng": lng}
        self.pending_address = address
        self.last_activity = datetime.utcnow()

    def clear_location(self) -> None:
        """Clear stored location"""
        self.pending_location = None
        self.pending_address = None

    def has_pending_analysis(self) -> bool:
        """Check if there's a pending analysis awaiting confirmation"""
        return self.pending_analysis is not None and not self.pending_analysis.confirmed_for_report

    def has_confirmed_analysis(self) -> bool:
        """Check if there's a confirmed analysis ready for submission"""
        return self.pending_analysis is not None and self.pending_analysis.confirmed_for_report

    def has_location(self) -> bool:
        """Check if location data is available"""
        return self.pending_location is not None

    def is_ready_for_submission(self) -> bool:
        """Check if all data is available for submission"""
        return self.has_confirmed_analysis() and self.has_location()

    def clear_all(self) -> None:
        """Clear all pending data (after submission or reset)"""
        self.pending_analysis = None
        self.pending_location = None
        self.pending_address = None
        self.last_activity = datetime.utcnow()

    def is_expired(self, timeout_minutes: int = 30) -> bool:
        """Check if memory has expired due to inactivity"""
        if self.last_activity is None:
            return True
        expiry_time = self.last_activity + timedelta(minutes=timeout_minutes)
        return datetime.utcnow() > expiry_time

    def touch(self) -> None:
        """Update last activity timestamp"""
        self.last_activity = datetime.utcnow()
