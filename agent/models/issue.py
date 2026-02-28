"""
Issue-related data models
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class IssueType(str, Enum):
    """Issue types aligned with ML classifier"""
    POTHOLE = "POTHOLE"
    GARBAGE = "GARBAGE"
    ILLEGAL_PARKING = "ILLEGAL_PARKING"
    DAMAGED_SIGN = "DAMAGED_SIGN"
    FALLEN_TREE = "FALLEN_TREE"
    VANDALISM = "VANDALISM"
    DEAD_ANIMAL = "DEAD_ANIMAL"
    DAMAGED_CONCRETE = "DAMAGED_CONCRETE"
    DAMAGED_ELECTRICAL = "DAMAGED_ELECTRICAL"


# Human-readable labels for issue types
ISSUE_TYPE_LABELS: Dict[IssueType, str] = {
    IssueType.POTHOLE: "Potholes & Road Damage",
    IssueType.GARBAGE: "Littering/Garbage",
    IssueType.ILLEGAL_PARKING: "Illegal Parking",
    IssueType.DAMAGED_SIGN: "Broken Road Signs",
    IssueType.FALLEN_TREE: "Fallen Trees",
    IssueType.VANDALISM: "Vandalism/Graffiti",
    IssueType.DEAD_ANIMAL: "Dead Animal Pollution",
    IssueType.DAMAGED_CONCRETE: "Damaged Concrete Structures",
    IssueType.DAMAGED_ELECTRICAL: "Damaged Electric Poles/Wires",
}


class LocationData(BaseModel):
    """Location data for an issue"""
    latitude: float
    longitude: float
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    geohash: Optional[str] = None


class CollectedIssueData(BaseModel):
    """Data collected during conversation for issue submission"""
    description: Optional[str] = None
    issue_type: Optional[IssueType] = None
    image_urls: List[str] = Field(default_factory=list)
    location: Optional[LocationData] = None

    # Additional context
    user_notes: Optional[str] = None
    severity_hint: Optional[str] = None  # User's perception of severity

    # Metadata
    collected_at: datetime = Field(default_factory=datetime.utcnow)
    conversation_id: Optional[str] = None

    def is_complete(self) -> bool:
        """Check if all required data is collected"""
        return bool(
            self.description
            and self.image_urls
            and self.location
        )

    def get_missing_fields(self) -> List[str]:
        """Get list of missing required fields"""
        missing = []
        if not self.description:
            missing.append("description")
        if not self.image_urls:
            missing.append("image")
        if not self.location:
            missing.append("location")
        return missing


class IssueData(BaseModel):
    """Complete issue data for submission"""
    id: Optional[str] = None
    type: IssueType
    description: str
    image_url: Optional[str] = None
    image_urls: List[str] = Field(default_factory=list)
    location: LocationData
    municipality_id: Optional[str] = None
    status: str = "OPEN"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Priority data (added by priority agent)
    priority_score: Optional[int] = None
    priority_severity: Optional[str] = None
    priority_reasoning: Optional[str] = None


class LocationStats(BaseModel):
    """Statistics for a geographic location (geohash)"""
    geohash: str
    center: Dict[str, float]  # {lat, lng}
    total_issues: int = 0
    issues_this_month: int = 0
    by_type: Dict[str, int] = Field(default_factory=dict)
    avg_resolution_hours: Optional[float] = None
    is_hotspot: bool = False  # True if 5+ issues/month
    updated_at: datetime = Field(default_factory=datetime.utcnow)
