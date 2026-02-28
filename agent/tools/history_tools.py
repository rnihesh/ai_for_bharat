"""
Historical data and analytics tools
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from services.firebase import firebase_service
from tools.location_tools import LocationTools


class HistoryTools:
    """Tools for historical data analysis"""

    @staticmethod
    async def get_location_history(lat: float, lng: float) -> Dict[str, Any]:
        """
        Get historical data for a location

        Args:
            lat: Latitude
            lng: Longitude

        Returns:
            Location history and statistics
        """
        geohash = LocationTools.encode_geohash(lat, lng, precision=6)
        stats = await firebase_service.get_location_stats(geohash)

        if not stats:
            return {
                "has_history": False,
                "is_hotspot": False,
                "total_issues": 0,
                "issues_this_month": 0,
                "by_type": {},
                "avg_resolution_hours": None,
            }

        return {
            "has_history": True,
            "is_hotspot": stats.get("is_hotspot", False),
            "total_issues": stats.get("total_issues", 0),
            "issues_this_month": stats.get("issues_this_month", 0),
            "by_type": stats.get("by_type", {}),
            "avg_resolution_hours": stats.get("avg_resolution_hours"),
            "geohash": geohash,
        }

    @staticmethod
    async def check_repeat_issue(
        lat: float,
        lng: float,
        issue_type: str,
        days: int = 30,
    ) -> Dict[str, Any]:
        """
        Check if this is a repeat issue at this location

        Args:
            lat: Latitude
            lng: Longitude
            issue_type: Type of issue
            days: Days to look back

        Returns:
            Repeat issue information
        """
        from tools.issue_tools import IssueTools

        # Get nearby issues
        nearby = await IssueTools.get_issues_by_location(lat, lng, radius_km=0.1)

        if not nearby:
            return {
                "is_repeat": False,
                "similar_count": 0,
                "recent_issues": [],
            }

        # Filter by type and date
        cutoff = datetime.utcnow() - timedelta(days=days)
        similar = []

        for issue in nearby:
            if issue.get("type") == issue_type:
                created_at = issue.get("createdAt")
                if created_at:
                    # Parse date if string
                    if isinstance(created_at, str):
                        try:
                            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                        except ValueError:
                            continue

                    if created_at > cutoff:
                        similar.append({
                            "id": issue.get("id"),
                            "status": issue.get("status"),
                            "created_at": str(created_at),
                        })

        return {
            "is_repeat": len(similar) > 0,
            "similar_count": len(similar),
            "recent_issues": similar[:5],  # Return up to 5 recent similar issues
        }

    @staticmethod
    async def get_hotspots_nearby(
        lat: float,
        lng: float,
        radius_km: float = 5.0,
    ) -> List[Dict[str, Any]]:
        """
        Get hotspot areas near a location

        Args:
            lat: Latitude
            lng: Longitude
            radius_km: Search radius

        Returns:
            List of nearby hotspots
        """
        geohash = LocationTools.encode_geohash(lat, lng, precision=4)
        hotspots = await firebase_service.get_nearby_hotspots(geohash, limit=10)

        # Filter by distance
        result = []
        for hotspot in hotspots:
            center = hotspot.get("center", {})
            if center:
                distance = LocationTools.calculate_distance(
                    lat, lng,
                    center.get("lat", 0),
                    center.get("lng", 0),
                )
                if distance <= radius_km * 1000:  # Convert to meters
                    hotspot["distance_meters"] = distance
                    result.append(hotspot)

        return sorted(result, key=lambda x: x.get("distance_meters", float("inf")))

    @staticmethod
    async def get_municipality_performance(municipality_id: str) -> Dict[str, Any]:
        """
        Get municipality performance metrics

        Args:
            municipality_id: Municipality ID

        Returns:
            Performance metrics
        """
        stats = await firebase_service.get_municipality_stats(municipality_id)
        open_count = await firebase_service.get_municipality_open_issues_count(municipality_id)

        if not stats:
            return {
                "has_data": False,
                "open_issues": open_count,
            }

        return {
            "has_data": True,
            "total_issues": stats.get("totalIssues", 0),
            "resolved_issues": stats.get("resolvedIssues", 0),
            "open_issues": open_count,
            "avg_resolution_hours": stats.get("avgResolutionTime"),
            "score": stats.get("score", 50),
            "performance_rating": HistoryTools._calculate_rating(stats),
        }

    @staticmethod
    def _calculate_rating(stats: Dict[str, Any]) -> str:
        """Calculate performance rating from stats"""
        score = stats.get("score", 50)
        if score >= 80:
            return "excellent"
        elif score >= 60:
            return "good"
        elif score >= 40:
            return "average"
        elif score >= 20:
            return "poor"
        else:
            return "critical"

    @staticmethod
    async def analyze_area_trends(
        lat: float,
        lng: float,
        radius_km: float = 2.0,
    ) -> Dict[str, Any]:
        """
        Analyze issue trends in an area

        Args:
            lat: Latitude
            lng: Longitude
            radius_km: Analysis radius

        Returns:
            Trend analysis
        """
        from tools.issue_tools import IssueTools

        # Get all issues in area
        issues = await IssueTools.get_issues_by_location(lat, lng, radius_km)

        if not issues:
            return {
                "total_issues": 0,
                "has_trends": False,
            }

        # Analyze by type
        by_type: Dict[str, int] = {}
        by_status: Dict[str, int] = {"OPEN": 0, "CLOSED": 0}

        for issue in issues:
            issue_type = issue.get("type", "UNKNOWN")
            status = issue.get("status", "OPEN")

            by_type[issue_type] = by_type.get(issue_type, 0) + 1
            by_status[status] = by_status.get(status, 0) + 1

        # Find most common issue type
        most_common = max(by_type.items(), key=lambda x: x[1]) if by_type else ("UNKNOWN", 0)

        return {
            "total_issues": len(issues),
            "has_trends": len(issues) >= 3,
            "by_type": by_type,
            "by_status": by_status,
            "most_common_type": most_common[0],
            "most_common_count": most_common[1],
            "resolution_rate": (
                by_status["CLOSED"] / len(issues) * 100
                if issues else 0
            ),
        }
