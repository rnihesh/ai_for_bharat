"""
DynamoDB Service
Provides database access via boto3
"""

import boto3
from typing import Optional, Dict, Any, List
from datetime import datetime
from config import config


class DynamoDBService:
    """Amazon DynamoDB client"""

    def __init__(self):
        self._resource = None
        self._client = None

    @property
    def is_configured(self) -> bool:
        return config.dynamodb.is_configured

    def initialize(self) -> bool:
        """Initialize DynamoDB client"""
        if self._resource is not None:
            return True

        try:
            self._resource = boto3.resource(
                "dynamodb",
                region_name=config.dynamodb.region,
            )
            self._client = boto3.client(
                "dynamodb",
                region_name=config.dynamodb.region,
            )
            return True
        except Exception as e:
            print(f"Failed to initialize DynamoDB: {e}")
            return False

    def _table(self, name: str):
        """Get a DynamoDB table resource"""
        if self._resource is None:
            if not self.initialize():
                raise RuntimeError("DynamoDB not initialized")
        prefix = config.dynamodb.table_prefix
        return self._resource.Table(f"{prefix}{name}")

    # ============================================
    # Location Stats Operations
    # ============================================

    async def get_location_stats(self, geohash: str) -> Optional[Dict[str, Any]]:
        """Get statistics for a location by geohash"""
        try:
            table = self._table("location_stats")
            response = table.get_item(Key={"locationKey": geohash})
            return response.get("Item")
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
            table = self._table("location_stats")
            existing = await self.get_location_stats(geohash)

            if existing:
                by_type = existing.get("by_type", {})
                by_type[issue_type] = by_type.get(issue_type, 0) + 1
                issues_this_month = existing.get("issues_this_month", 0) + 1

                table.update_item(
                    Key={"locationKey": geohash},
                    UpdateExpression="SET total_issues = total_issues + :inc, issues_this_month = :itm, by_type = :bt, is_hotspot = :hs, updated_at = :now",
                    ExpressionAttributeValues={
                        ":inc": 1,
                        ":itm": issues_this_month,
                        ":bt": by_type,
                        ":hs": issues_this_month >= 5,
                        ":now": datetime.utcnow().isoformat(),
                    },
                )
            else:
                table.put_item(
                    Item={
                        "locationKey": geohash,
                        "center": center,
                        "total_issues": 1,
                        "issues_this_month": 1,
                        "by_type": {issue_type: 1},
                        "avg_resolution_hours": None,
                        "is_hotspot": False,
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                )
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
            table = self._table("location_stats")
            response = table.scan(
                FilterExpression="is_hotspot = :hs",
                ExpressionAttributeValues={":hs": True},
                Limit=limit * 3,  # Over-fetch since we filter by prefix
            )

            results = []
            for item in response.get("Items", []):
                loc_key = item.get("locationKey", "")
                if loc_key.startswith(geohash_prefix[:4]):
                    results.append(item)
                    if len(results) >= limit:
                        break

            # Sort by issues_this_month descending
            results.sort(key=lambda x: x.get("issues_this_month", 0), reverse=True)
            return results[:limit]

        except Exception as e:
            print(f"Error getting nearby hotspots: {e}")
            return []

    # ============================================
    # Issue Operations
    # ============================================

    async def get_issue(self, issue_id: str) -> Optional[Dict[str, Any]]:
        """Get an issue by ID"""
        try:
            table = self._table("issues")
            response = table.get_item(Key={"issueId": issue_id})
            item = response.get("Item")
            if item:
                item["id"] = item.get("issueId", issue_id)
            return item
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
            table = self._table("issues")
            table.update_item(
                Key={"issueId": issue_id},
                UpdateExpression="SET priority_score = :ps, priority_severity = :psv, priority_reasoning = :pr, priority_scored_at = :now",
                ExpressionAttributeValues={
                    ":ps": priority_score,
                    ":psv": priority_severity,
                    ":pr": priority_reasoning,
                    ":now": datetime.utcnow().isoformat(),
                },
            )
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
            table = self._table("municipalities")
            response = table.get_item(Key={"municipalityId": municipality_id})
            return response.get("Item")
        except Exception as e:
            print(f"Error getting municipality stats: {e}")
            return None

    async def get_municipality_open_issues_count(self, municipality_id: str) -> int:
        """Get count of open issues for a municipality"""
        try:
            table = self._table("issues")
            response = table.query(
                IndexName="gsi-municipalityId-createdAt",
                KeyConditionExpression="municipalityId = :mid",
                FilterExpression="#s = :status",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":mid": municipality_id,
                    ":status": "OPEN",
                },
                Select="COUNT",
            )
            return response.get("Count", 0)
        except Exception as e:
            print(f"Error counting open issues: {e}")
            return 0


# Global service instance
dynamodb_service = DynamoDBService()
