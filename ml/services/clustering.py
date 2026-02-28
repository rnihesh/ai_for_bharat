"""
DBSCAN Clustering Service for Municipal Issues

Groups nearby issues using DBSCAN with Haversine distance metric.
No training required - uses geographic proximity to cluster issues.
"""

import numpy as np
from sklearn.cluster import DBSCAN
from typing import List, Dict, Any, Optional
from collections import Counter
import math


class ClusteringService:
    """
    Service for clustering municipal issues by geographic proximity.
    Uses DBSCAN algorithm with Haversine distance for accurate geo-clustering.
    """

    # Default parameters
    DEFAULT_EPS_METERS = 50  # Maximum distance between issues in a cluster (meters)
    DEFAULT_MIN_SAMPLES = 2  # Minimum issues to form a cluster

    # Earth radius in meters
    EARTH_RADIUS_M = 6371000

    # Severity weights by issue type (for aggregate severity calculation)
    ISSUE_TYPE_SEVERITY = {
        "DAMAGED_ELECTRICAL": 9,
        "FALLEN_TREE": 8,
        "DEAD_ANIMAL": 7,
        "POTHOLE": 6,
        "DAMAGED_CONCRETE": 6,
        "DAMAGED_SIGN": 5,
        "GARBAGE": 4,
        "ILLEGAL_PARKING": 3,
        "VANDALISM": 3,
    }

    def __init__(self, eps_meters: float = DEFAULT_EPS_METERS, min_samples: int = DEFAULT_MIN_SAMPLES):
        """
        Initialize clustering service.

        Args:
            eps_meters: Maximum distance between issues in a cluster (in meters)
            min_samples: Minimum number of issues to form a cluster
        """
        self.eps_meters = eps_meters
        self.min_samples = min_samples
        # Convert eps from meters to radians for haversine
        self.eps_radians = eps_meters / self.EARTH_RADIUS_M

    @staticmethod
    def haversine_distance(coords1: np.ndarray, coords2: np.ndarray) -> np.ndarray:
        """
        Calculate Haversine distance between coordinate pairs.

        Args:
            coords1: Array of [lat, lng] in radians
            coords2: Array of [lat, lng] in radians

        Returns:
            Distance in radians
        """
        lat1, lng1 = coords1
        lat2, lng2 = coords2

        dlat = lat2 - lat1
        dlng = lng2 - lng1

        a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlng/2)**2
        return 2 * np.arcsin(np.sqrt(a))

    def _create_distance_matrix(self, coords_radians: np.ndarray) -> np.ndarray:
        """
        Create pairwise distance matrix using Haversine formula.

        Args:
            coords_radians: Array of coordinates in radians [[lat, lng], ...]

        Returns:
            Distance matrix in radians
        """
        n = len(coords_radians)
        distances = np.zeros((n, n))

        for i in range(n):
            for j in range(i + 1, n):
                dist = self.haversine_distance(coords_radians[i], coords_radians[j])
                distances[i, j] = dist
                distances[j, i] = dist

        return distances

    def cluster_issues(self, issues: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Cluster issues by geographic proximity.

        Args:
            issues: List of issues with 'id', 'location' (lat/lng), and optionally 'type', 'severity'

        Returns:
            Dictionary with 'clusters' and 'unclustered' issues
        """
        if not issues:
            return {"clusters": [], "unclustered": [], "statistics": {}}

        if len(issues) < self.min_samples:
            return {
                "clusters": [],
                "unclustered": issues,
                "statistics": {
                    "total_issues": len(issues),
                    "clustered_count": 0,
                    "unclustered_count": len(issues),
                    "cluster_count": 0,
                }
            }

        # Extract coordinates
        coords = []
        valid_issues = []
        for issue in issues:
            loc = issue.get("location", {})
            lat = loc.get("latitude") or loc.get("lat")
            lng = loc.get("longitude") or loc.get("lng")
            if lat is not None and lng is not None:
                coords.append([lat, lng])
                valid_issues.append(issue)

        if len(coords) < self.min_samples:
            return {
                "clusters": [],
                "unclustered": issues,
                "statistics": {
                    "total_issues": len(issues),
                    "clustered_count": 0,
                    "unclustered_count": len(issues),
                    "cluster_count": 0,
                }
            }

        # Convert to radians
        coords_array = np.array(coords)
        coords_radians = np.radians(coords_array)

        # Create distance matrix
        distance_matrix = self._create_distance_matrix(coords_radians)

        # Run DBSCAN with precomputed distances
        dbscan = DBSCAN(
            eps=self.eps_radians,
            min_samples=self.min_samples,
            metric="precomputed"
        )
        labels = dbscan.fit_predict(distance_matrix)

        # Group issues by cluster
        clusters_dict: Dict[int, List[Dict[str, Any]]] = {}
        unclustered = []

        for idx, label in enumerate(labels):
            if label == -1:
                unclustered.append(valid_issues[idx])
            else:
                if label not in clusters_dict:
                    clusters_dict[label] = []
                clusters_dict[label].append(valid_issues[idx])

        # Build cluster objects with metadata
        clusters = []
        for cluster_id, cluster_issues in clusters_dict.items():
            cluster = self._build_cluster(cluster_id, cluster_issues)
            clusters.append(cluster)

        # Sort clusters by severity (highest first)
        clusters.sort(key=lambda c: c["aggregateSeverity"], reverse=True)

        return {
            "clusters": clusters,
            "unclustered": unclustered,
            "statistics": {
                "total_issues": len(valid_issues),
                "clustered_count": sum(len(c["issues"]) for c in clusters),
                "unclustered_count": len(unclustered),
                "cluster_count": len(clusters),
                "avg_cluster_size": round(sum(len(c["issues"]) for c in clusters) / len(clusters), 2) if clusters else 0,
            }
        }

    def _build_cluster(self, cluster_id: int, issues: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Build a cluster object with centroid, severity, and dominant type.

        Args:
            cluster_id: Cluster identifier
            issues: List of issues in this cluster

        Returns:
            Cluster object with metadata
        """
        # Calculate centroid
        lats = []
        lngs = []
        for issue in issues:
            loc = issue.get("location", {})
            lat = loc.get("latitude") or loc.get("lat")
            lng = loc.get("longitude") or loc.get("lng")
            if lat is not None and lng is not None:
                lats.append(lat)
                lngs.append(lng)

        centroid = {
            "latitude": sum(lats) / len(lats),
            "longitude": sum(lngs) / len(lngs),
        }

        # Calculate aggregate severity
        severities = []
        for issue in issues:
            # Use provided severity or calculate from type
            severity = issue.get("severity")
            if severity is None:
                issue_type = issue.get("type", "")
                severity = self.ISSUE_TYPE_SEVERITY.get(issue_type, 5)
            severities.append(severity)

        aggregate_severity = round(sum(severities) / len(severities), 1)

        # Determine severity level
        if aggregate_severity >= 8:
            severity_level = "CRITICAL"
        elif aggregate_severity >= 6:
            severity_level = "HIGH"
        elif aggregate_severity >= 4:
            severity_level = "MEDIUM"
        else:
            severity_level = "LOW"

        # Find dominant issue type
        types = [issue.get("type") for issue in issues if issue.get("type")]
        type_counts = Counter(types)
        dominant_type = type_counts.most_common(1)[0][0] if type_counts else None

        # Calculate cluster radius (max distance from centroid)
        max_distance = 0
        for lat, lng in zip(lats, lngs):
            dist = self._haversine_distance_m(
                centroid["latitude"], centroid["longitude"],
                lat, lng
            )
            max_distance = max(max_distance, dist)

        return {
            "id": f"cluster_{cluster_id}",
            "centroid": centroid,
            "issueCount": len(issues),
            "aggregateSeverity": aggregate_severity,
            "severityLevel": severity_level,
            "dominantType": dominant_type,
            "typeCounts": dict(type_counts),
            "radiusMeters": round(max_distance, 2),
            "issues": [{"id": issue.get("id"), "type": issue.get("type")} for issue in issues],
            "issueIds": [issue.get("id") for issue in issues],
        }

    def _haversine_distance_m(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """
        Calculate Haversine distance in meters between two points.

        Args:
            lat1, lng1: First point coordinates (degrees)
            lat2, lng2: Second point coordinates (degrees)

        Returns:
            Distance in meters
        """
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        lng1_rad = math.radians(lng1)
        lng2_rad = math.radians(lng2)

        dlat = lat2_rad - lat1_rad
        dlng = lng2_rad - lng1_rad

        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
        c = 2 * math.asin(math.sqrt(a))

        return self.EARTH_RADIUS_M * c


# Global instance
_clustering_service: Optional[ClusteringService] = None


def get_clustering_service(eps_meters: float = 50, min_samples: int = 2) -> ClusteringService:
    """Get or create the clustering service instance."""
    global _clustering_service
    if _clustering_service is None:
        _clustering_service = ClusteringService(eps_meters=eps_meters, min_samples=min_samples)
    return _clustering_service
