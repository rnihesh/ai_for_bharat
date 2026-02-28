"""
Issue submission and management tools
"""

import httpx
from typing import Dict, Any, Optional, List
from config import config
from models.issue import CollectedIssueData, LocationData, IssueType


class IssueTools:
    """Tools for issue operations"""

    @staticmethod
    async def classify_image(image_url: str) -> Dict[str, Any]:
        """
        Classify an issue image using the ML service

        Args:
            image_url: URL of the image

        Returns:
            Classification results
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{config.services.ml_service}/classify",
                json={"imageUrl": image_url},
            )
            response.raise_for_status()
            return response.json()

    @staticmethod
    async def generate_description(
        image_url: str,
        issue_type: Optional[str] = None,
    ) -> str:
        """
        Generate a description for an issue using the ML service

        Args:
            image_url: URL of the image
            issue_type: Optional issue type

        Returns:
            Generated description
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{config.services.ml_service}/generate-description",
                json={
                    "imageUrl": image_url,
                    "issueType": issue_type or "",
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("description", "")

    @staticmethod
    async def submit_issue(issue_data: CollectedIssueData) -> Dict[str, Any]:
        """
        Submit an issue to the main server

        Args:
            issue_data: Collected issue data

        Returns:
            Submission result with issue ID
        """
        print(f"[IssueTools] Attempting to submit issue...")
        print(f"[IssueTools] Description: {issue_data.description}")
        print(f"[IssueTools] Image URLs: {issue_data.image_urls}")
        print(f"[IssueTools] Location: {issue_data.location}")
        print(f"[IssueTools] Issue type: {issue_data.issue_type}")

        if not issue_data.is_complete():
            missing = issue_data.get_missing_fields()
            print(f"[IssueTools] INCOMPLETE - Missing fields: {missing}")
            return {
                "success": False,
                "error": f"Missing required fields: {', '.join(missing)}",
            }

        # Prepare submission payload
        payload = {
            "description": issue_data.description,
            "location": {
                "latitude": issue_data.location.latitude,
                "longitude": issue_data.location.longitude,
            },
        }

        # Only include imageUrl if we have images (avoid sending null)
        if issue_data.image_urls:
            payload["imageUrl"] = issue_data.image_urls[0]
            payload["imageUrls"] = issue_data.image_urls

        if issue_data.issue_type:
            payload["type"] = issue_data.issue_type.value

        print(f"[IssueTools] Submitting to: {config.services.main_server}/api/issues")
        print(f"[IssueTools] Payload: {payload}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{config.services.main_server}/api/issues",
                    json=payload,
                )

                print(f"[IssueTools] Response status: {response.status_code}")
                print(f"[IssueTools] Response body: {response.text}")

                if response.status_code >= 400:
                    return {
                        "success": False,
                        "error": f"Server error: {response.text}",
                    }

                data = response.json()
                issue_id = data.get("data", {}).get("id")
                print(f"[IssueTools] SUCCESS - Issue ID: {issue_id}")
                return {
                    "success": data.get("success", False),
                    "issue_id": issue_id,
                    "data": data.get("data"),
                    "error": data.get("error"),
                }
            except Exception as e:
                print(f"[IssueTools] EXCEPTION: {e}")
                return {
                    "success": False,
                    "error": f"Request failed: {str(e)}",
                }

    @staticmethod
    async def get_issue(issue_id: str) -> Optional[Dict[str, Any]]:
        """
        Get an issue by ID from the main server

        Args:
            issue_id: Issue ID

        Returns:
            Issue data or None
        """
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{config.services.main_server}/api/issues/{issue_id}",
            )

            if response.status_code == 404:
                return None

            response.raise_for_status()
            data = response.json()
            return data.get("data")

    @staticmethod
    async def get_issues_by_location(
        lat: float,
        lng: float,
        radius_km: float = 1.0,
    ) -> List[Dict[str, Any]]:
        """
        Get issues near a location

        Args:
            lat: Latitude
            lng: Longitude
            radius_km: Search radius in kilometers

        Returns:
            List of nearby issues
        """
        # Calculate bounds
        lat_delta = radius_km / 111.0  # 1 degree lat ~ 111 km
        lng_delta = radius_km / (111.0 * abs(lat) / 90 + 0.01)  # Adjust for latitude

        bounds = {
            "north": lat + lat_delta,
            "south": lat - lat_delta,
            "east": lng + lng_delta,
            "west": lng - lng_delta,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            params = {
                "north": bounds["north"],
                "south": bounds["south"],
                "east": bounds["east"],
                "west": bounds["west"],
            }
            response = await client.get(
                f"{config.services.main_server}/api/issues/map/bounds",
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("data", [])

    @staticmethod
    def map_ml_type_to_issue_type(ml_class: str) -> Optional[IssueType]:
        """
        Map ML classification to IssueType enum

        Args:
            ml_class: ML class name

        Returns:
            IssueType or None
        """
        mapping = {
            "Potholes and Road Damage": IssueType.POTHOLE,
            "Littering": IssueType.GARBAGE,
            "Illegal Parking Issues": IssueType.ILLEGAL_PARKING,
            "Broken Road Sign Issues": IssueType.DAMAGED_SIGN,
            "Fallen trees": IssueType.FALLEN_TREE,
            "Vandalism Issues": IssueType.VANDALISM,
            "Dead Animal Pollution": IssueType.DEAD_ANIMAL,
            "Damaged concrete structures": IssueType.DAMAGED_CONCRETE,
            "Damaged Electric wires and poles": IssueType.DAMAGED_ELECTRICAL,
        }
        return mapping.get(ml_class)

    @staticmethod
    def get_issue_type_label(issue_type: IssueType) -> str:
        """
        Get human-readable label for issue type

        Args:
            issue_type: IssueType enum value

        Returns:
            Human-readable label
        """
        labels = {
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
        return labels.get(issue_type, str(issue_type))
