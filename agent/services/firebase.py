"""
Firebase Service
Provides Firestore database access
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

from config import config


class FirebaseService:
    """Firebase Admin SDK client"""

    def __init__(self):
        self._app: Optional[firebase_admin.App] = None
        self._db: Optional[firestore.Client] = None

    @property
    def is_configured(self) -> bool:
        return config.firebase.is_configured

    def initialize(self) -> bool:
        """Initialize Firebase Admin SDK"""
        if self._app is not None:
            return True

        if not self.is_configured:
            print("Firebase not configured - skipping initialization")
            return False

        try:
            cred = credentials.Certificate({
                "type": "service_account",
                "project_id": config.firebase.project_id,
                "client_email": config.firebase.client_email,
                "private_key": config.firebase.private_key,
                "token_uri": "https://oauth2.googleapis.com/token",
            })

            self._app = firebase_admin.initialize_app(cred, name="agent-service")
            self._db = firestore.client(app=self._app)
            return True

        except Exception as e:
            print(f"Failed to initialize Firebase: {e}")
            return False

    @property
    def db(self) -> firestore.Client:
        """Get Firestore client"""
        if self._db is None:
            if not self.initialize():
                raise RuntimeError("Firebase not initialized")
        return self._db

    # ============================================
    # Location Stats Operations
    # ============================================

    async def get_location_stats(self, geohash: str) -> Optional[Dict[str, Any]]:
        """Get statistics for a location by geohash"""
        try:
            doc = self.db.collection("location_stats").document(geohash).get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            print(f"Error getting location stats: {e}")
            return None

    async def update_location_stats(
        self,
        geohash: str,
        center: Dict[str, float],
        issue_type: str,
    ) -> bool:
        """Update location statistics when a new issue is reported"""
        try:
            doc_ref = self.db.collection("location_stats").document(geohash)
            doc = doc_ref.get()

            if doc.exists:
                data = doc.to_dict()
                data["total_issues"] = data.get("total_issues", 0) + 1
                data["issues_this_month"] = data.get("issues_this_month", 0) + 1
                data["by_type"] = data.get("by_type", {})
                data["by_type"][issue_type] = data["by_type"].get(issue_type, 0) + 1
                data["is_hotspot"] = data["issues_this_month"] >= 5
                data["updated_at"] = datetime.utcnow()
            else:
                data = {
                    "geohash": geohash,
                    "center": center,
                    "total_issues": 1,
                    "issues_this_month": 1,
                    "by_type": {issue_type: 1},
                    "avg_resolution_hours": None,
                    "is_hotspot": False,
                    "updated_at": datetime.utcnow(),
                }

            doc_ref.set(data)
            return True

        except Exception as e:
            print(f"Error updating location stats: {e}")
            return False

    async def get_nearby_hotspots(
        self,
        geohash_prefix: str,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Get hotspots near a location (by geohash prefix)"""
        try:
            # Query for documents with matching geohash prefix
            docs = (
                self.db.collection("location_stats")
                .where("is_hotspot", "==", True)
                .order_by("issues_this_month", direction=firestore.Query.DESCENDING)
                .limit(limit)
                .stream()
            )

            results = []
            for doc in docs:
                data = doc.to_dict()
                # Filter by geohash prefix
                if data.get("geohash", "").startswith(geohash_prefix[:4]):
                    results.append(data)

            return results

        except Exception as e:
            print(f"Error getting nearby hotspots: {e}")
            return []

    # ============================================
    # Issue Operations
    # ============================================

    async def get_issue(self, issue_id: str) -> Optional[Dict[str, Any]]:
        """Get an issue by ID"""
        try:
            doc = self.db.collection("issues").document(issue_id).get()
            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                return data
            return None
        except Exception as e:
            print(f"Error getting issue: {e}")
            return None

    async def update_issue_priority(
        self,
        issue_id: str,
        priority_score: int,
        priority_severity: str,
        priority_reasoning: str,
    ) -> bool:
        """Update an issue's priority score"""
        try:
            self.db.collection("issues").document(issue_id).update({
                "priority_score": priority_score,
                "priority_severity": priority_severity,
                "priority_reasoning": priority_reasoning,
                "priority_scored_at": datetime.utcnow(),
            })
            return True
        except Exception as e:
            print(f"Error updating issue priority: {e}")
            return False

    # ============================================
    # Municipality Operations
    # ============================================

    async def get_municipality_stats(self, municipality_id: str) -> Optional[Dict[str, Any]]:
        """Get municipality statistics"""
        try:
            doc = self.db.collection("municipalities").document(municipality_id).get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            print(f"Error getting municipality stats: {e}")
            return None

    async def get_municipality_open_issues_count(self, municipality_id: str) -> int:
        """Get count of open issues for a municipality"""
        try:
            docs = (
                self.db.collection("issues")
                .where("municipalityId", "==", municipality_id)
                .where("status", "==", "OPEN")
                .stream()
            )
            return sum(1 for _ in docs)
        except Exception as e:
            print(f"Error counting open issues: {e}")
            return 0


# Global service instance
firebase_service = FirebaseService()
