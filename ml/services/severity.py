"""
Severity Scoring Service

Uses EfficientNet-B0 model to predict severity scores (1-10) from images.
Falls back to rule-based scoring if model is not available.
"""

import numpy as np
from pathlib import Path
from typing import Dict, Optional, Tuple
from io import BytesIO
import requests
from PIL import Image

# Try to import TensorFlow (may not be available in all environments)
try:
    import tensorflow as tf
    from tensorflow.keras.models import load_model
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False


class SeverityService:
    """
    Service for predicting severity scores from issue images.
    """

    # Image preprocessing constants
    IMG_SIZE = (224, 224)

    # Rule-based severity by issue type (fallback)
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

    # Severity level thresholds
    SEVERITY_LEVELS = {
        (8, 10): "CRITICAL",
        (6, 8): "HIGH",
        (4, 6): "MEDIUM",
        (1, 4): "LOW",
    }

    def __init__(self, model_path: Optional[Path] = None):
        """
        Initialize severity service.

        Args:
            model_path: Path to trained Keras model (optional)
        """
        self.model = None
        self.model_loaded = False

        if model_path is None:
            model_path = Path(__file__).parent.parent / "models" / "severity_model.keras"

        self.model_path = model_path
        self._load_model()

    def _load_model(self):
        """Load the trained severity model if available."""
        if not TF_AVAILABLE:
            print("TensorFlow not available, using rule-based severity scoring")
            return

        if self.model_path.exists():
            try:
                self.model = load_model(str(self.model_path))
                self.model_loaded = True
                print(f"Severity model loaded from {self.model_path}")
            except Exception as e:
                print(f"Failed to load severity model: {e}")
                print("Using rule-based severity scoring")
        else:
            print(f"Severity model not found at {self.model_path}")
            print("Using rule-based severity scoring")

    def _preprocess_image(self, img: Image.Image) -> np.ndarray:
        """
        Preprocess image for model inference.

        Args:
            img: PIL Image

        Returns:
            Preprocessed numpy array
        """
        img = img.convert("RGB")
        img = img.resize(self.IMG_SIZE)
        img_array = np.array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)
        return img_array

    def _download_image(self, image_url: str) -> Image.Image:
        """Download image from URL."""
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        return Image.open(BytesIO(response.content))

    def _get_severity_level(self, score: float) -> str:
        """Get severity level from score."""
        for (low, high), level in self.SEVERITY_LEVELS.items():
            if low <= score < high:
                return level
        return "CRITICAL" if score >= 8 else "LOW"

    def predict_from_image(
        self,
        image_url: Optional[str] = None,
        image_bytes: Optional[bytes] = None,
        issue_type: Optional[str] = None,
    ) -> Dict:
        """
        Predict severity score from image.

        Args:
            image_url: URL of the image
            image_bytes: Raw image bytes (alternative to URL)
            issue_type: Issue type for fallback/adjustment

        Returns:
            Dictionary with score, level, confidence, factors
        """
        ml_score = None
        ml_confidence = 0.0

        # Try ML prediction if model is loaded
        if self.model_loaded and (image_url or image_bytes):
            try:
                if image_url:
                    img = self._download_image(image_url)
                else:
                    img = Image.open(BytesIO(image_bytes))

                img_array = self._preprocess_image(img)
                prediction = self.model.predict(img_array, verbose=0)[0][0]

                # Convert from sigmoid (0-1) to severity (1-10)
                ml_score = float(prediction * 9 + 1)
                ml_confidence = 0.85  # Base confidence for ML prediction

            except Exception as e:
                print(f"ML prediction failed: {e}")

        # Rule-based score from issue type
        rule_score = self.ISSUE_TYPE_SEVERITY.get(issue_type, 5)

        # Combine ML and rule-based scores
        if ml_score is not None:
            # Weight ML score more heavily if we have it
            final_score = ml_score * 0.7 + rule_score * 0.3
            confidence = ml_confidence
            factors = ["ML image analysis", f"Issue type: {issue_type}"]
        else:
            final_score = rule_score
            confidence = 0.6  # Lower confidence for rule-based only
            factors = [f"Issue type: {issue_type}", "Rule-based scoring"]

        final_score = round(max(1, min(10, final_score)), 1)
        level = self._get_severity_level(final_score)

        return {
            "score": final_score,
            "level": level,
            "confidence": round(confidence, 2),
            "factors": factors,
            "mlScore": ml_score,
            "ruleScore": rule_score,
        }

    def predict_batch(
        self,
        issues: list,
    ) -> list:
        """
        Predict severity for multiple issues.

        Args:
            issues: List of issues with imageUrl and type

        Returns:
            List of severity predictions
        """
        results = []
        for issue in issues:
            prediction = self.predict_from_image(
                image_url=issue.get("imageUrl"),
                issue_type=issue.get("type"),
            )
            prediction["issueId"] = issue.get("id")
            results.append(prediction)
        return results


# Global instance
_severity_service: Optional[SeverityService] = None


def get_severity_service() -> SeverityService:
    """Get or create the severity service instance."""
    global _severity_service
    if _severity_service is None:
        _severity_service = SeverityService()
    return _severity_service
