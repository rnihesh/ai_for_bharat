"""
Risk Prediction Service

Uses XGBoost model to predict infrastructure risk scores based on
weather, location, and historical factors.
"""

import json
import numpy as np
from pathlib import Path
from typing import Dict, Optional, List
from datetime import datetime

# Try to import ML libraries
try:
    import joblib
    JOBLIB_AVAILABLE = True
except ImportError:
    JOBLIB_AVAILABLE = False


class RiskService:
    """
    Service for predicting infrastructure risk scores.
    """

    # Feature columns (must match training)
    FEATURE_COLUMNS = [
        "rainfall_mm",
        "temperature_c",
        "humidity_pct",
        "is_monsoon",
        "latitude",
        "longitude",
        "road_type_highway",
        "road_type_urban",
        "road_type_rural",
        "traffic_density",
        "issue_count_30d",
        "is_hotspot",
        "resolution_rate",
        "days_since_last_issue",
        "population_density",
    ]

    # Default values for missing features
    DEFAULT_VALUES = {
        "rainfall_mm": 0,
        "temperature_c": 30,
        "humidity_pct": 60,
        "is_monsoon": 0,
        "road_type_highway": 0,
        "road_type_urban": 1,
        "road_type_rural": 0,
        "traffic_density": 0.5,
        "issue_count_30d": 5,
        "is_hotspot": 0,
        "resolution_rate": 0.7,
        "days_since_last_issue": 30,
        "population_density": 0.5,
    }

    # Risk level thresholds
    RISK_LEVELS = {
        (0.8, 1.0): "CRITICAL",
        (0.6, 0.8): "HIGH",
        (0.3, 0.6): "MEDIUM",
        (0.0, 0.3): "LOW",
    }

    def __init__(self, model_path: Optional[Path] = None, scaler_path: Optional[Path] = None):
        """
        Initialize risk service.

        Args:
            model_path: Path to trained XGBoost model
            scaler_path: Path to feature scaler
        """
        self.model = None
        self.scaler = None
        self.model_loaded = False

        models_dir = Path(__file__).parent.parent / "models"

        if model_path is None:
            model_path = models_dir / "risk_model.joblib"
        if scaler_path is None:
            scaler_path = models_dir / "risk_scaler.joblib"

        self.model_path = model_path
        self.scaler_path = scaler_path
        self._load_model()

    def _load_model(self):
        """Load the trained model and scaler if available."""
        if not JOBLIB_AVAILABLE:
            print("joblib not available, using rule-based risk scoring")
            return

        if self.model_path.exists() and self.scaler_path.exists():
            try:
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                self.model_loaded = True
                print(f"Risk model loaded from {self.model_path}")
            except Exception as e:
                print(f"Failed to load risk model: {e}")
                print("Using rule-based risk scoring")
        else:
            print(f"Risk model not found at {self.model_path}")
            print("Using rule-based risk scoring")

    def _get_risk_level(self, score: float) -> str:
        """Get risk level from score."""
        for (low, high), level in self.RISK_LEVELS.items():
            if low <= score < high:
                return level
        return "CRITICAL" if score >= 0.8 else "LOW"

    def _is_monsoon_season(self) -> bool:
        """Check if current month is monsoon season in India (June-September)."""
        month = datetime.now().month
        return month in [6, 7, 8, 9]

    def _rule_based_risk(self, features: Dict) -> float:
        """
        Calculate risk using rule-based approach.

        Args:
            features: Dictionary of feature values

        Returns:
            Risk score (0-1)
        """
        risk = 0.3  # Base risk

        # Weather factors
        rainfall = features.get("rainfall_mm", 0)
        if rainfall > 100:
            risk += 0.2
        elif rainfall > 50:
            risk += 0.1

        if features.get("is_monsoon", 0):
            risk += 0.1

        # Historical factors
        if features.get("is_hotspot", 0):
            risk += 0.15

        issue_count = features.get("issue_count_30d", 0)
        if issue_count > 20:
            risk += 0.15
        elif issue_count > 10:
            risk += 0.1

        resolution_rate = features.get("resolution_rate", 0.7)
        risk -= resolution_rate * 0.1

        # Traffic factor
        traffic = features.get("traffic_density", 0.5)
        risk += traffic * 0.1

        return max(0.0, min(1.0, risk))

    def predict(
        self,
        latitude: float,
        longitude: float,
        rainfall_mm: float = 0,
        temperature_c: float = 30,
        humidity_pct: float = 60,
        road_type: str = "urban",
        traffic_density: float = 0.5,
        issue_count_30d: int = 5,
        is_hotspot: bool = False,
        resolution_rate: float = 0.7,
        days_since_last_issue: int = 30,
        population_density: float = 0.5,
    ) -> Dict:
        """
        Predict risk score for a location.

        Args:
            latitude: Location latitude
            longitude: Location longitude
            rainfall_mm: Daily rainfall in mm
            temperature_c: Temperature in Celsius
            humidity_pct: Humidity percentage
            road_type: Type of road (highway, urban, rural)
            traffic_density: Traffic density (0-1)
            issue_count_30d: Issues in area in last 30 days
            is_hotspot: Whether location is a known problem area
            resolution_rate: Historical resolution rate (0-1)
            days_since_last_issue: Days since last issue reported
            population_density: Population density (0-1)

        Returns:
            Dictionary with riskScore, riskLevel, factors
        """
        # Prepare feature dictionary
        is_monsoon = self._is_monsoon_season()

        features = {
            "rainfall_mm": rainfall_mm,
            "temperature_c": temperature_c,
            "humidity_pct": humidity_pct,
            "is_monsoon": 1 if is_monsoon else 0,
            "latitude": latitude,
            "longitude": longitude,
            "road_type_highway": 1 if road_type == "highway" else 0,
            "road_type_urban": 1 if road_type == "urban" else 0,
            "road_type_rural": 1 if road_type == "rural" else 0,
            "traffic_density": traffic_density,
            "issue_count_30d": issue_count_30d,
            "is_hotspot": 1 if is_hotspot else 0,
            "resolution_rate": resolution_rate,
            "days_since_last_issue": days_since_last_issue,
            "population_density": population_density,
        }

        # Identify risk factors
        risk_factors = []
        if rainfall_mm > 50:
            risk_factors.append(f"Heavy rainfall ({rainfall_mm}mm)")
        if is_monsoon:
            risk_factors.append("Monsoon season")
        if is_hotspot:
            risk_factors.append("Known problem area")
        if issue_count_30d > 10:
            risk_factors.append(f"High issue density ({issue_count_30d} recent issues)")
        if resolution_rate < 0.5:
            risk_factors.append(f"Low resolution rate ({resolution_rate*100:.0f}%)")
        if traffic_density > 0.7:
            risk_factors.append("High traffic area")

        # ML prediction if available
        if self.model_loaded:
            try:
                # Build feature vector in correct order
                feature_vector = np.array([[features[col] for col in self.FEATURE_COLUMNS]])
                feature_vector_scaled = self.scaler.transform(feature_vector)
                ml_score = float(self.model.predict(feature_vector_scaled)[0])
                ml_score = max(0.0, min(1.0, ml_score))
                confidence = 0.85
            except Exception as e:
                print(f"ML prediction failed: {e}")
                ml_score = self._rule_based_risk(features)
                confidence = 0.6
        else:
            ml_score = self._rule_based_risk(features)
            confidence = 0.6

        risk_level = self._get_risk_level(ml_score)

        return {
            "riskScore": round(ml_score, 4),
            "riskLevel": risk_level,
            "confidence": confidence,
            "factors": risk_factors if risk_factors else ["Standard conditions"],
            "location": {
                "latitude": latitude,
                "longitude": longitude,
            },
            "weather": {
                "rainfall_mm": rainfall_mm,
                "temperature_c": temperature_c,
                "humidity_pct": humidity_pct,
                "is_monsoon": is_monsoon,
            },
        }

    def predict_grid(
        self,
        bounds: Dict[str, float],
        grid_size: int = 10,
        weather: Optional[Dict] = None,
    ) -> List[Dict]:
        """
        Predict risk for a grid of points within bounds.

        Args:
            bounds: Dictionary with north, south, east, west
            grid_size: Number of points per axis
            weather: Optional weather data

        Returns:
            List of risk predictions for grid points
        """
        north = bounds.get("north", 0)
        south = bounds.get("south", 0)
        east = bounds.get("east", 0)
        west = bounds.get("west", 0)

        lat_step = (north - south) / grid_size
        lng_step = (east - west) / grid_size

        weather = weather or {}

        results = []
        for i in range(grid_size):
            for j in range(grid_size):
                lat = south + (i + 0.5) * lat_step
                lng = west + (j + 0.5) * lng_step

                prediction = self.predict(
                    latitude=lat,
                    longitude=lng,
                    rainfall_mm=weather.get("rainfall_mm", 0),
                    temperature_c=weather.get("temperature_c", 30),
                    humidity_pct=weather.get("humidity_pct", 60),
                )

                results.append({
                    "latitude": lat,
                    "longitude": lng,
                    "riskScore": prediction["riskScore"],
                    "riskLevel": prediction["riskLevel"],
                })

        return results


# Global instance
_risk_service: Optional[RiskService] = None


def get_risk_service() -> RiskService:
    """Get or create the risk service instance."""
    global _risk_service
    if _risk_service is None:
        _risk_service = RiskService()
    return _risk_service
