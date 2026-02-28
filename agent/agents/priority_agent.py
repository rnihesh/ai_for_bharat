"""
Priority Agent for scoring issue severity
"""

from typing import Dict, Any, Optional
from models.priority import PriorityScore, PriorityFactors, PrioritySeverity
from agents.base_agent import BaseAgent
from tools.image_tools import ImageTools
from tools.location_tools import LocationTools
from tools.weather_tools import WeatherTools
from tools.history_tools import HistoryTools
from tools.issue_tools import IssueTools
from services.firebase import firebase_service


class PriorityAgent(BaseAgent):
    """
    Priority agent for scoring issue severity and urgency.

    Scoring Factors (weighted):
    - Image Severity (35%): Visual damage assessment
    - Location Context (25%): Near schools/hospitals, main roads
    - Historical Data (20%): Repeat issues, hotspot detection
    - Time & Weather (10%): Seasonal factors, time of day
    - Municipality Workload (10%): Current open issues, avg resolution time
    """

    # Weights for each factor
    WEIGHTS = {
        "image": 0.35,
        "location": 0.25,
        "history": 0.20,
        "temporal": 0.10,
        "workload": 0.10,
    }

    async def score_issue(
        self,
        issue_id: Optional[str] = None,
        image_url: Optional[str] = None,
        description: Optional[str] = None,
        location: Optional[Dict[str, float]] = None,
        issue_type: Optional[str] = None,
    ) -> PriorityScore:
        """
        Score an issue's priority

        Args:
            issue_id: Optional issue ID
            image_url: Image URL
            description: Issue description
            location: Location coordinates {lat, lng}
            issue_type: Type of issue

        Returns:
            PriorityScore with detailed factors
        """
        factors = PriorityFactors()

        # 1. Image Severity (35%)
        if image_url:
            image_score = await self._assess_image_severity(image_url, issue_type)
            factors.image_severity_score = image_score["score"]
            factors.image_severity_reasoning = image_score["reasoning"]

        # 2. Location Context (25%)
        if location:
            lat = location.get("lat") or location.get("latitude")
            lng = location.get("lng") or location.get("longitude")
            if lat and lng:
                location_score = await self._assess_location_context(lat, lng)
                factors.location_context_score = location_score["score"]
                factors.location_context_reasoning = location_score["reasoning"]
                factors.near_sensitive_location = location_score["near_sensitive"]
                factors.is_main_road = location_score["is_main_road"]

        # 3. Historical Data (20%)
        if location:
            lat = location.get("lat") or location.get("latitude")
            lng = location.get("lng") or location.get("longitude")
            if lat and lng:
                history_score = await self._assess_historical_data(lat, lng, issue_type)
                factors.historical_score = history_score["score"]
                factors.historical_reasoning = history_score["reasoning"]
                factors.repeat_issue_count = history_score["repeat_count"]
                factors.is_hotspot = history_score["is_hotspot"]

        # 4. Time & Weather (10%)
        if location:
            lat = location.get("lat") or location.get("latitude")
            lng = location.get("lng") or location.get("longitude")
            if lat and lng:
                temporal_score = await self._assess_temporal_factors(lat, lng)
                factors.temporal_score = temporal_score["score"]
                factors.temporal_reasoning = temporal_score["reasoning"]

        # 5. Municipality Workload (10%)
        # This would need municipality ID which comes from location
        workload_score = self._assess_workload_factors(factors)
        factors.workload_score = workload_score["score"]
        factors.workload_reasoning = workload_score["reasoning"]

        # Calculate final score
        final_score = self._calculate_final_score(factors)
        severity = PriorityScore.calculate_severity(final_score)
        response_time = PriorityScore.get_response_time(severity)

        # Generate overall reasoning
        reasoning = self._generate_reasoning(factors, severity)
        recommended_action = self._get_recommended_action(severity, factors)

        priority_result = PriorityScore(
            issue_id=issue_id,
            score=final_score,
            severity=severity,
            reasoning=reasoning,
            recommended_action=recommended_action,
            estimated_response_time=response_time,
            factors=factors,
        )

        # Save priority to Firebase if we have an issue ID
        if issue_id:
            try:
                saved = await firebase_service.update_issue_priority(
                    issue_id=issue_id,
                    priority_score=final_score,
                    priority_severity=severity.value,
                    priority_reasoning=reasoning,
                )
                if saved:
                    print(f"[PriorityAgent] Priority saved to Firebase for issue {issue_id}")
                else:
                    print(f"[PriorityAgent] Failed to save priority to Firebase for issue {issue_id}")
            except Exception as e:
                print(f"[PriorityAgent] Error saving priority to Firebase: {e}")

        return priority_result

    async def score_issue_by_id(self, issue_id: str) -> PriorityScore:
        """
        Score an issue by fetching its data from the server

        Args:
            issue_id: Issue ID

        Returns:
            PriorityScore
        """
        issue = await IssueTools.get_issue(issue_id)

        if not issue:
            raise ValueError(f"Issue {issue_id} not found")

        image_url = issue.get("imageUrl") or (issue.get("imageUrls", []) or [None])[0]
        location = issue.get("location", {})

        return await self.score_issue(
            issue_id=issue_id,
            image_url=image_url,
            description=issue.get("description"),
            location={
                "lat": location.get("latitude"),
                "lng": location.get("longitude"),
            },
            issue_type=issue.get("type"),
        )

    async def _assess_image_severity(
        self,
        image_url: str,
        issue_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Assess severity from image"""
        try:
            analysis = await ImageTools.assess_severity(image_url, issue_type)

            score = analysis.get("severity_score", 5)
            safety = analysis.get("safety_hazard", "medium")
            size = analysis.get("size", "medium")
            urgency = analysis.get("urgency", "medium")

            reasoning = analysis.get("reasoning", "")
            if not reasoning:
                reasoning = f"Safety hazard: {safety}, Size: {size}, Urgency: {urgency}"

            return {
                "score": min(10, max(1, score)),
                "reasoning": reasoning,
            }

        except Exception as e:
            print(f"Error assessing image severity: {e}")
            return {
                "score": 5,
                "reasoning": "Unable to assess image - using default score",
            }

    async def _assess_location_context(
        self,
        lat: float,
        lng: float,
    ) -> Dict[str, Any]:
        """Assess location context factors"""
        try:
            landmarks = await LocationTools.get_nearby_landmarks(lat, lng)

            score = 5  # Base score
            reasons = []

            # Near school - high priority
            if landmarks.get("near_school"):
                score += 2
                reasons.append("Near school")

            # Near hospital - high priority
            if landmarks.get("near_hospital"):
                score += 2
                reasons.append("Near hospital")

            # On main road - higher visibility/impact
            if landmarks.get("on_main_road"):
                score += 1.5
                reasons.append("On main road")

            # Near traffic signals - higher traffic
            if landmarks.get("traffic_signals", 0) > 0:
                score += 0.5
                reasons.append("Near traffic signals")

            return {
                "score": min(10, max(1, score)),
                "reasoning": ", ".join(reasons) if reasons else "Standard location",
                "near_sensitive": landmarks.get("near_school") or landmarks.get("near_hospital"),
                "is_main_road": landmarks.get("on_main_road", False),
            }

        except Exception as e:
            print(f"Error assessing location: {e}")
            return {
                "score": 5,
                "reasoning": "Unable to assess location context",
                "near_sensitive": False,
                "is_main_road": False,
            }

    async def _assess_historical_data(
        self,
        lat: float,
        lng: float,
        issue_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Assess historical data for the location"""
        try:
            history = await HistoryTools.get_location_history(lat, lng)

            score = 5
            reasons = []

            # Hotspot area
            if history.get("is_hotspot"):
                score += 2
                reasons.append("Hotspot area")

            # Check for repeat issues
            if issue_type:
                repeat_info = await HistoryTools.check_repeat_issue(lat, lng, issue_type)
                repeat_count = repeat_info.get("similar_count", 0)

                if repeat_count >= 3:
                    score += 2
                    reasons.append(f"Recurring issue ({repeat_count} similar reports)")
                elif repeat_count > 0:
                    score += 1
                    reasons.append(f"Previously reported ({repeat_count} similar)")
            else:
                repeat_count = 0

            # High volume area
            if history.get("issues_this_month", 0) >= 10:
                score += 1
                reasons.append("High-activity area")

            return {
                "score": min(10, max(1, score)),
                "reasoning": ", ".join(reasons) if reasons else "No significant history",
                "repeat_count": repeat_count if issue_type else 0,
                "is_hotspot": history.get("is_hotspot", False),
            }

        except Exception as e:
            print(f"Error assessing historical data: {e}")
            return {
                "score": 5,
                "reasoning": "Unable to assess historical data",
                "repeat_count": 0,
                "is_hotspot": False,
            }

    async def _assess_temporal_factors(
        self,
        lat: float,
        lng: float,
    ) -> Dict[str, Any]:
        """Assess time and weather factors"""
        try:
            time_factors = WeatherTools.get_time_factors()
            seasonal_factors = WeatherTools.get_seasonal_factors(lat)

            score = 5
            reasons = []

            # Rush hour increases priority
            if time_factors.get("is_rush_hour"):
                score += 1
                reasons.append("Rush hour")

            # Monsoon season affects certain issues
            if seasonal_factors.get("season") == "monsoon":
                score += seasonal_factors.get("pothole_severity_multiplier", 1) - 1
                reasons.append("Monsoon season")

            # Night visibility concerns
            if time_factors.get("is_night"):
                score += 0.5
                reasons.append("Night - visibility concern")

            # Try to get weather
            try:
                weather = await WeatherTools.get_current_weather(lat, lng)
                if weather.get("available"):
                    if weather.get("is_rainy"):
                        score += 1
                        reasons.append("Rainy weather")
                    if weather.get("is_extreme"):
                        score += 1
                        reasons.append("Extreme weather")
            except Exception:
                pass

            return {
                "score": min(10, max(1, score)),
                "reasoning": ", ".join(reasons) if reasons else "Normal conditions",
            }

        except Exception as e:
            print(f"Error assessing temporal factors: {e}")
            return {
                "score": 5,
                "reasoning": "Unable to assess temporal factors",
            }

    def _assess_workload_factors(self, factors: PriorityFactors) -> Dict[str, Any]:
        """Assess municipality workload factors"""
        # This would typically check municipality's current workload
        # For now, use base score

        score = 5
        reasons = []

        # If it's a hotspot and high severity, municipality might be overwhelmed
        if factors.is_hotspot and factors.image_severity_score >= 7:
            score += 1
            reasons.append("High-priority area with heavy workload")

        return {
            "score": min(10, max(1, score)),
            "reasoning": ", ".join(reasons) if reasons else "Normal workload",
        }

    def _calculate_final_score(self, factors: PriorityFactors) -> int:
        """Calculate weighted final score"""
        weighted_sum = (
            factors.image_severity_score * self.WEIGHTS["image"]
            + factors.location_context_score * self.WEIGHTS["location"]
            + factors.historical_score * self.WEIGHTS["history"]
            + factors.temporal_score * self.WEIGHTS["temporal"]
            + factors.workload_score * self.WEIGHTS["workload"]
        )

        # Round to nearest integer, clamp to 1-10
        return min(10, max(1, round(weighted_sum)))

    def _generate_reasoning(
        self,
        factors: PriorityFactors,
        severity: PrioritySeverity,
    ) -> str:
        """Generate human-readable reasoning"""
        parts = []

        if factors.image_severity_reasoning:
            parts.append(f"Image analysis: {factors.image_severity_reasoning}")

        if factors.location_context_reasoning and factors.location_context_reasoning != "Standard location":
            parts.append(f"Location: {factors.location_context_reasoning}")

        if factors.historical_reasoning and factors.historical_reasoning != "No significant history":
            parts.append(f"History: {factors.historical_reasoning}")

        if factors.temporal_reasoning and factors.temporal_reasoning != "Normal conditions":
            parts.append(f"Conditions: {factors.temporal_reasoning}")

        if not parts:
            parts.append("Standard priority assessment")

        return ". ".join(parts) + f". Overall severity: {severity.value}."

    def _get_recommended_action(
        self,
        severity: PrioritySeverity,
        factors: PriorityFactors,
    ) -> str:
        """Get recommended action based on severity"""
        actions = {
            PrioritySeverity.CRITICAL: "Dispatch emergency repair team immediately. Issue poses significant safety risk.",
            PrioritySeverity.HIGH: "Schedule repair within 24-48 hours. Prioritize over routine maintenance.",
            PrioritySeverity.MEDIUM: "Add to regular maintenance queue. Address within the week.",
            PrioritySeverity.LOW: "Schedule for routine maintenance during next cycle.",
        }

        base_action = actions.get(severity, "Review and assess.")

        # Add specific recommendations based on factors
        if factors.near_sensitive_location:
            base_action += " Extra caution near sensitive location (school/hospital)."

        if factors.is_hotspot:
            base_action += " Consider long-term solution for this hotspot area."

        if factors.repeat_issue_count >= 3:
            base_action += " Investigate root cause of recurring issue."

        return base_action
