"""
Location-related tools
"""

import httpx
import geohash2
from typing import Dict, Any, Optional, Tuple
from config import config


class LocationTools:
    """Tools for location operations"""

    @staticmethod
    def encode_geohash(lat: float, lng: float, precision: int = 6) -> str:
        """
        Encode coordinates to geohash

        Args:
            lat: Latitude
            lng: Longitude
            precision: Geohash precision (default 6)

        Returns:
            Geohash string
        """
        return geohash2.encode(lat, lng, precision=precision)

    @staticmethod
    def decode_geohash(gh: str) -> Tuple[float, float]:
        """
        Decode geohash to coordinates

        Args:
            gh: Geohash string

        Returns:
            Tuple of (latitude, longitude)
        """
        lat, lng = geohash2.decode(gh)
        return float(lat), float(lng)

    @staticmethod
    def get_geohash_bounds(gh: str) -> Dict[str, float]:
        """
        Get bounding box for a geohash

        Args:
            gh: Geohash string

        Returns:
            Dict with north, south, east, west bounds
        """
        bbox = geohash2.decode_exactly(gh)
        lat, lng, lat_err, lng_err = bbox
        return {
            "north": lat + lat_err,
            "south": lat - lat_err,
            "east": lng + lng_err,
            "west": lng - lng_err,
        }

    @staticmethod
    async def reverse_geocode(lat: float, lng: float) -> Dict[str, Any]:
        """
        Convert coordinates to address using Google Maps API

        Args:
            lat: Latitude
            lng: Longitude

        Returns:
            Address information
        """
        # Use Google Maps Geocoding API
        google_api_key = config.services.main_server  # Will need to be added to config

        # For now, use a free alternative (Nominatim)
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": lat,
                    "lon": lng,
                    "format": "json",
                    "addressdetails": 1,
                },
                headers={"User-Agent": "CivicLemma/1.0"},
            )
            response.raise_for_status()
            data = response.json()

        address = data.get("address", {})
        return {
            "formatted_address": data.get("display_name", ""),
            "city": address.get("city") or address.get("town") or address.get("village", ""),
            "district": address.get("county") or address.get("state_district", ""),
            "state": address.get("state", ""),
            "country": address.get("country", ""),
            "pincode": address.get("postcode", ""),
            "road": address.get("road", ""),
            "suburb": address.get("suburb") or address.get("neighbourhood", ""),
        }

    @staticmethod
    async def get_nearby_landmarks(lat: float, lng: float) -> Dict[str, Any]:
        """
        Get nearby landmarks and points of interest

        Args:
            lat: Latitude
            lng: Longitude

        Returns:
            Nearby landmarks info
        """
        # Use Overpass API to find nearby important places
        query = f"""
        [out:json][timeout:10];
        (
          node["amenity"~"school|hospital|police|fire_station"](around:500,{lat},{lng});
          node["highway"="traffic_signals"](around:200,{lat},{lng});
          way["highway"~"primary|secondary|trunk"](around:100,{lat},{lng});
        );
        out body;
        """

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(
                    "https://overpass-api.de/api/interpreter",
                    data={"data": query},
                )
                response.raise_for_status()
                data = response.json()

                landmarks = {
                    "schools": [],
                    "hospitals": [],
                    "police_stations": [],
                    "main_roads": [],
                    "traffic_signals": 0,
                }

                for element in data.get("elements", []):
                    tags = element.get("tags", {})
                    amenity = tags.get("amenity", "")
                    highway = tags.get("highway", "")
                    name = tags.get("name", "Unknown")

                    if amenity == "school":
                        landmarks["schools"].append(name)
                    elif amenity == "hospital":
                        landmarks["hospitals"].append(name)
                    elif amenity == "police":
                        landmarks["police_stations"].append(name)
                    elif highway in ["primary", "secondary", "trunk"]:
                        road_name = tags.get("name", "Main Road")
                        if road_name not in landmarks["main_roads"]:
                            landmarks["main_roads"].append(road_name)
                    elif highway == "traffic_signals":
                        landmarks["traffic_signals"] += 1

                landmarks["near_school"] = len(landmarks["schools"]) > 0
                landmarks["near_hospital"] = len(landmarks["hospitals"]) > 0
                landmarks["on_main_road"] = len(landmarks["main_roads"]) > 0

                return landmarks

            except Exception as e:
                print(f"Error fetching landmarks: {e}")
                return {
                    "schools": [],
                    "hospitals": [],
                    "police_stations": [],
                    "main_roads": [],
                    "traffic_signals": 0,
                    "near_school": False,
                    "near_hospital": False,
                    "on_main_road": False,
                }

    @staticmethod
    def calculate_distance(
        lat1: float, lng1: float,
        lat2: float, lng2: float,
    ) -> float:
        """
        Calculate distance between two points in meters

        Args:
            lat1, lng1: First point
            lat2, lng2: Second point

        Returns:
            Distance in meters
        """
        import math

        R = 6371000  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lng2 - lng1)

        a = (
            math.sin(delta_phi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c
