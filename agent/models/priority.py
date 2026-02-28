"""
Priority scoring models
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class PrioritySeverity(str, Enum):
    """Issue severity levels"""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class PriorityFactors(BaseModel):
    """Individual factors contributing to priority score"""
    # Image severity (35%)
    image_severity_score: float = 0.0
    image_severity_reasoning: str = ""

    # Location context (25%)
    location_context_score: float = 0.0
    location_context_reasoning: str = ""
    near_sensitive_location: bool = False
    is_main_road: bool = False

    # Historical data (20%)
    historical_score: float = 0.0
    historical_reasoning: str = ""
    repeat_issue_count: int = 0
    is_hotspot: bool = False

    # Time and weather (10%)
    temporal_score: float = 0.0
    temporal_reasoning: str = ""

    # Municipality workload (10%)
    workload_score: float = 0.0
    workload_reasoning: str = ""
    municipality_open_issues: int = 0
    municipality_avg_resolution_hours: Optional[float] = None


class PriorityScore(BaseModel):
    """Complete priority score for an issue"""
    issue_id: Optional[str] = None
    score: int = Field(ge=1, le=10, default=5)
    severity: PrioritySeverity = PrioritySeverity.MEDIUM
    reasoning: str = ""
    recommended_action: str = ""
    estimated_response_time: str = ""
    factors: PriorityFactors = Field(default_factory=PriorityFactors)
    scored_at: datetime = Field(default_factory=datetime.utcnow)

    @classmethod
    def calculate_severity(cls, score: int) -> PrioritySeverity:
        """Calculate severity level from score"""
        if score >= 9:
            return PrioritySeverity.CRITICAL
        elif score >= 7:
            return PrioritySeverity.HIGH
        elif score >= 4:
            return PrioritySeverity.MEDIUM
        else:
            return PrioritySeverity.LOW

    @classmethod
    def get_response_time(cls, severity: PrioritySeverity) -> str:
        """Get estimated response time based on severity"""
        response_times = {
            PrioritySeverity.CRITICAL: "4-8 hours",
            PrioritySeverity.HIGH: "24-48 hours",
            PrioritySeverity.MEDIUM: "3-5 days",
            PrioritySeverity.LOW: "1-2 weeks",
        }
        return response_times.get(severity, "Unknown")


class BatchPriorityRequest(BaseModel):
    """Request for batch priority scoring"""
    issue_ids: List[str]


class BatchPriorityResponse(BaseModel):
    """Response for batch priority scoring"""
    scores: List[PriorityScore]
    total_processed: int
    errors: List[str] = Field(default_factory=list)
