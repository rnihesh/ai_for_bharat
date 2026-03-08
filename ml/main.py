"""
FastAPI server for Municipal Issue Image Classification
Runs the trained MobileNetV2 model for inference
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import tensorflow as tf
from tensorflow.keras.models import load_model
import numpy as np
from pathlib import Path
import json
import requests
from io import BytesIO
from PIL import Image
import os
import boto3
import base64
from dotenv import load_dotenv
import uvicorn

# Import ML services
from services.clustering import get_clustering_service
from services.severity import get_severity_service
from services.risk import get_risk_service

# Load environment variables from .env file in same directory
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# FastAPI app
app = FastAPI(
    title="Municipal Issue Classifier API",
    description="ML service for classifying municipal issues from images",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
IMG_SIZE = (224, 224)
CONFIDENCE_THRESHOLD = 0.70  # Minimum confidence to accept
WARNING_THRESHOLD = 0.85  # Below this, show warning
ENTROPY_THRESHOLD = 1.5  # High entropy = uncertain = likely unrelated image
MAX_SECONDARY_RATIO = 0.6  # If second-best is too close to best, image is ambiguous

# Image quality thresholds
MIN_BRIGHTNESS = 15  # Reject very dark images (0-255 scale)
MAX_BRIGHTNESS = 245  # Reject very bright/white images
MIN_VARIANCE = 200  # Reject uniform/blank images (low texture)
MIN_EDGE_DENSITY = 0.01  # Reject images with no edges/features

# Load model and class mapping
MODEL_PATH = Path(__file__).parent / "models" / "best_model.keras"
CLASS_MAPPING_PATH = Path(__file__).parent / "models" / "class_mapping.json"

# Global model variable
model = None
class_mapping = None

# ML class name to issue type mapping
ML_CLASS_TO_ISSUE_TYPE = {
    "Potholes and Road Damage": "POTHOLE",
    "Littering": "GARBAGE",
    "Illegal Parking Issues": "ILLEGAL_PARKING",
    "Broken Road Sign Issues": "DAMAGED_SIGN",
    "Fallen trees": "FALLEN_TREE",
    "Vandalism Issues": "VANDALISM",
    "Dead Animal Pollution": "DEAD_ANIMAL",
    "Damaged concrete structures": "DAMAGED_CONCRETE",
    "Damaged Electric wires and poles": "DAMAGED_ELECTRICAL",
}


# Pydantic models
class ClassifyRequest(BaseModel):
    imageUrl: str


class GenerateDescriptionRequest(BaseModel):
    imageUrl: str
    issueType: Optional[str] = ""


# SSRF protection: only allow trusted image domains
ALLOWED_IMAGE_HOSTS = [
    ".s3.amazonaws.com",
    ".s3.ap-south-1.amazonaws.com",
    ".cloudfront.net",
]

def validate_image_url(image_url: str) -> None:
    """Validate that image URL points to a trusted domain to prevent SSRF."""
    from urllib.parse import urlparse
    parsed = urlparse(image_url)
    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="Only HTTPS image URLs are accepted.")
    host = parsed.hostname.lower() if parsed.hostname else ""
    cloudfront_domain = os.getenv("CLOUDFRONT_DOMAIN", "").lower()
    if cloudfront_domain and host == cloudfront_domain:
        return
    if any(host.endswith(allowed) for allowed in ALLOWED_IMAGE_HOSTS):
        return
    raise HTTPException(status_code=400, detail="Invalid image URL. Only images uploaded to our platform are accepted.")


class PredictionResult(BaseModel):
    className: str
    probability: float
    issueType: Optional[str] = None


class ClassifyResponse(BaseModel):
    success: bool
    isValid: Optional[bool] = None
    isUnrelated: Optional[bool] = None
    className: Optional[str] = None
    issueType: Optional[str] = None
    confidence: Optional[float] = None
    entropy: Optional[float] = None
    message: Optional[str] = None
    allPredictions: Optional[List[PredictionResult]] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool


class IssueType(BaseModel):
    className: str
    issueType: str


class IssueTypesResponse(BaseModel):
    success: bool
    issueTypes: List[IssueType]
    count: int


class DescriptionResponse(BaseModel):
    success: bool
    description: Optional[str] = None
    error: Optional[str] = None


# ============================================
# CLUSTERING MODELS
# ============================================

class IssueLocation(BaseModel):
    latitude: Optional[float] = Field(None, alias="latitude")
    longitude: Optional[float] = Field(None, alias="longitude")
    lat: Optional[float] = None
    lng: Optional[float] = None


class ClusterIssue(BaseModel):
    id: str
    location: IssueLocation
    type: Optional[str] = None
    severity: Optional[float] = None


class ClusterRequest(BaseModel):
    issues: List[ClusterIssue]
    eps_meters: float = 50
    min_samples: int = 2


class ClusterInfo(BaseModel):
    id: str
    centroid: Dict[str, float]
    issueCount: int
    aggregateSeverity: float
    severityLevel: str
    dominantType: Optional[str]
    typeCounts: Dict[str, int]
    radiusMeters: float
    issueIds: List[str]


class ClusterResponse(BaseModel):
    success: bool
    clusters: List[ClusterInfo]
    unclustered: List[Dict[str, Any]]
    statistics: Dict[str, Any]


# ============================================
# SEVERITY MODELS
# ============================================

class SeverityRequest(BaseModel):
    imageUrl: Optional[str] = None
    issueType: Optional[str] = None


class SeverityResponse(BaseModel):
    success: bool
    score: float
    level: str
    confidence: float
    factors: List[str]
    mlScore: Optional[float] = None
    ruleScore: Optional[float] = None


# ============================================
# RISK MODELS
# ============================================

class RiskRequest(BaseModel):
    latitude: float
    longitude: float
    rainfall_mm: float = 0
    temperature_c: float = 30
    humidity_pct: float = 60
    road_type: str = "urban"
    traffic_density: float = 0.5
    issue_count_30d: int = 5
    is_hotspot: bool = False
    resolution_rate: float = 0.7
    days_since_last_issue: int = 30
    population_density: float = 0.5


class RiskResponse(BaseModel):
    success: bool
    riskScore: float
    riskLevel: str
    confidence: float
    factors: List[str]
    location: Dict[str, float]
    weather: Dict[str, Any]


class RiskGridRequest(BaseModel):
    bounds: Dict[str, float]  # north, south, east, west
    grid_size: int = 10
    weather: Optional[Dict[str, float]] = None


class RiskGridResponse(BaseModel):
    success: bool
    predictions: List[Dict[str, Any]]
    bounds: Dict[str, float]
    gridSize: int


def load_classifier():
    """Load the trained model and class mapping"""
    global model, class_mapping

    if model is None:
        print(f"Loading model from {MODEL_PATH}...")
        model = load_model(str(MODEL_PATH))
        print("Model loaded successfully!")

    if class_mapping is None:
        with open(CLASS_MAPPING_PATH, "r") as f:
            class_mapping = json.load(f)
        print(f"Loaded {class_mapping['num_classes']} classes")

    return model, class_mapping


def preprocess_image_from_url(image_url: str) -> np.ndarray:
    """Download and preprocess image from URL"""
    validate_image_url(image_url)
    response = requests.get(image_url, timeout=10)
    response.raise_for_status()

    img = Image.open(BytesIO(response.content))
    img = img.convert("RGB")
    img = img.resize(IMG_SIZE)

    img_array = np.array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    return img_array


def preprocess_image_from_bytes(img_bytes: bytes) -> np.ndarray:
    """Preprocess image from bytes"""
    img = Image.open(BytesIO(img_bytes))
    img = img.convert("RGB")
    img = img.resize(IMG_SIZE)

    img_array = np.array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    return img_array


def check_image_quality(img_array: np.ndarray) -> tuple[bool, str]:
    """
    Check if image is valid (not blank, black, white, or low quality).
    Returns (is_valid, rejection_reason)
    """
    # Remove batch dimension for analysis
    img = img_array[0] if len(img_array.shape) == 4 else img_array

    # Convert back to 0-255 scale for analysis
    img_uint8 = (img * 255).astype(np.uint8)

    # Check 1: Average brightness (detect black/white images)
    avg_brightness = np.mean(img_uint8)
    if avg_brightness < MIN_BRIGHTNESS:
        return False, f"Image too dark (avg brightness: {avg_brightness:.0f}/255)"
    if avg_brightness > MAX_BRIGHTNESS:
        return (
            False,
            f"Image too bright/white (avg brightness: {avg_brightness:.0f}/255)",
        )

    # Check 2: Variance (detect uniform/blank images)
    variance = np.var(img_uint8)
    if variance < MIN_VARIANCE:
        return False, f"Image lacks detail/texture (variance: {variance:.0f})"

    # Check 3: Edge detection using simple gradient
    gray = np.mean(img_uint8, axis=2)
    gradient_x = np.abs(np.diff(gray, axis=1))
    gradient_y = np.abs(np.diff(gray, axis=0))
    edge_density = (np.mean(gradient_x) + np.mean(gradient_y)) / 255.0
    if edge_density < MIN_EDGE_DENSITY:
        return (
            False,
            f"Image has no distinct features (edge density: {edge_density:.3f})",
        )

    # Check 4: Color diversity (reject single-color images)
    r_std = np.std(img_uint8[:, :, 0])
    g_std = np.std(img_uint8[:, :, 1])
    b_std = np.std(img_uint8[:, :, 2])
    color_diversity = (r_std + g_std + b_std) / 3
    if color_diversity < 10:
        return False, f"Image is mostly a single color"

    return True, ""


def download_image(image_url: str) -> Image.Image:
    """Download image from URL and return PIL Image"""
    validate_image_url(image_url)
    response = requests.get(image_url, timeout=10)
    response.raise_for_status()
    return Image.open(BytesIO(response.content)).convert("RGB")


def calculate_entropy(probabilities: np.ndarray) -> float:
    """
    Calculate Shannon entropy of probability distribution.
    Higher entropy = more uncertainty = likely unrelated image.
    Max entropy for 9 classes = log(9) ≈ 2.2
    """
    # Avoid log(0) by adding small epsilon
    probs = np.clip(probabilities, 1e-10, 1.0)
    entropy = -np.sum(probs * np.log(probs))
    return float(entropy)


def is_likely_unrelated(predictions: np.ndarray) -> tuple[bool, str]:
    """
    Detect if image is likely unrelated to municipal issues.
    Returns (is_unrelated, reason)
    """
    sorted_probs = np.sort(predictions)[::-1]
    top_prob = sorted_probs[0]
    second_prob = sorted_probs[1]

    entropy = calculate_entropy(predictions)

    # Check 1: High entropy (uncertainty across classes)
    if entropy > ENTROPY_THRESHOLD:
        return True, f"High uncertainty (entropy: {entropy:.2f})"

    # Check 2: Top prediction is low
    if top_prob < 0.5:
        return True, f"Low confidence ({top_prob*100:.0f}%)"

    # Check 3: Second prediction is too close to top (ambiguous)
    if second_prob > 0 and (second_prob / top_prob) > MAX_SECONDARY_RATIO:
        return (
            True,
            f"Ambiguous classification (top two: {top_prob*100:.0f}% vs {second_prob*100:.0f}%)",
        )

    return False, ""


@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    print("=" * 60)
    print("Municipal Issue Classifier API (FastAPI)")
    print("=" * 60)
    load_classifier()
    
    region = os.environ.get("AWS_REGION", "us-east-1")
    print(f"✓ AWS Bedrock configured (region: {region}) - description generation enabled")
    print("=" * 60)


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        model_loaded=model is not None,
    )


@app.get("/models")
async def get_models_info():
    """Get information about loaded ML models and their metrics"""
    global model, class_mapping

    # Check which models are available
    severity_model_path = Path(__file__).parent / "models" / "severity_model.keras"
    risk_model_path = Path(__file__).parent / "models" / "risk_model.joblib"
    eval_report_path = Path(__file__).parent / "models" / "evaluation_report.json"
    severity_metrics_path = Path(__file__).parent / "models" / "severity_metrics.json"

    models_info = {
        "classifier": {
            "name": "MobileNetV2 Issue Classifier",
            "status": "loaded" if model is not None else "not_loaded",
            "classes": list(ML_CLASS_TO_ISSUE_TYPE.keys()) if class_mapping else [],
            "num_classes": len(ML_CLASS_TO_ISSUE_TYPE),
        },
        "severity": {
            "name": "EfficientNet-B0 Severity Scorer",
            "status": "available" if severity_model_path.exists() else "not_trained",
            "metrics": None,
        },
        "risk": {
            "name": "XGBoost Risk Predictor",
            "status": "available" if risk_model_path.exists() else "not_trained",
        },
        "clustering": {
            "name": "DBSCAN Geographic Clustering",
            "status": "ready",
            "algorithm": "DBSCAN with Haversine Distance",
            "default_params": {"eps_meters": 50, "min_samples": 2},
        },
    }

    # Load severity metrics if available
    if severity_metrics_path.exists():
        try:
            with open(severity_metrics_path, "r") as f:
                severity_metrics = json.load(f)
                models_info["severity"]["metrics"] = {
                    "mae": round(severity_metrics.get("val_mae_scaled", 0), 2),
                    "mse": round(severity_metrics.get("val_loss", 0), 4),
                    "training_samples": severity_metrics.get("training_samples", 0),
                    "validation_samples": severity_metrics.get("validation_samples", 0),
                }
        except Exception:
            pass

    # Load evaluation report if available
    evaluation = None
    if eval_report_path.exists():
        try:
            with open(eval_report_path, "r") as f:
                evaluation = json.load(f)
        except Exception:
            pass

    return {
        "success": True,
        "models": models_info,
        "evaluation": evaluation,
        "capabilities": [
            "Image classification (9 issue types)",
            "Severity scoring (1-10 scale)",
            "Geographic clustering (DBSCAN)",
            "Risk prediction (weather + location)",
        ],
    }


@app.post("/classify", response_model=ClassifyResponse)
async def classify(request: ClassifyRequest):
    """
    Classify an image to identify municipal issues
    
    Accepts JSON with imageUrl field
    """
    global model, class_mapping

    try:
        # Ensure model is loaded
        model, class_mapping = load_classifier()

        img_array = preprocess_image_from_url(request.imageUrl)

        # Check image quality BEFORE running ML model
        is_quality_valid, quality_reason = check_image_quality(img_array)
        if not is_quality_valid:
            return ClassifyResponse(
                success=True,
                isValid=False,
                isUnrelated=True,
                className=None,
                issueType=None,
                confidence=0,
                entropy=0,
                message=f"Invalid image: {quality_reason}. Please upload a clear photo of the municipal issue.",
                allPredictions=[],
            )

        # Run inference
        predictions = model.predict(img_array, verbose=0)[0]

        # Get top prediction
        top_idx = int(np.argmax(predictions))
        top_confidence = float(predictions[top_idx])
        top_class = class_mapping["index_to_class"][str(top_idx)]

        # Check if image is likely unrelated to municipal issues
        is_unrelated, unrelated_reason = is_likely_unrelated(predictions)
        entropy = calculate_entropy(predictions)

        # Get all predictions sorted by probability
        all_predictions = []
        for idx, prob in enumerate(predictions):
            class_name = class_mapping["index_to_class"][str(idx)]
            all_predictions.append(
                PredictionResult(
                    className=class_name,
                    probability=float(prob),
                    issueType=ML_CLASS_TO_ISSUE_TYPE.get(class_name),
                )
            )
        all_predictions.sort(key=lambda x: x.probability, reverse=True)

        # Determine if valid based on confidence AND unrelated check
        is_valid = top_confidence >= CONFIDENCE_THRESHOLD and not is_unrelated
        issue_type = ML_CLASS_TO_ISSUE_TYPE.get(top_class) if is_valid else None

        # Generate message
        if is_unrelated:
            message = (
                f"This image doesn't appear to show a municipal issue. "
                f"Reason: {unrelated_reason}. "
                f"Please upload a clear photo of the issue (pothole, garbage, vandalism, etc.)."
            )
        elif not is_valid:
            message = (
                f"Unable to confidently classify this image ({top_confidence*100:.0f}% confidence). "
                f"The image may not clearly show a municipal issue. "
                f"Please upload a clearer image or select the issue type manually."
            )
        elif top_confidence < WARNING_THRESHOLD:
            message = (
                f"Detected as '{top_class}' with {top_confidence*100:.0f}% confidence. "
                f"Please confirm this is the correct issue type."
            )
        else:
            message = (
                f"Detected as '{top_class}' with {top_confidence*100:.0f}% confidence."
            )

        return ClassifyResponse(
            success=True,
            isValid=is_valid,
            isUnrelated=is_unrelated,
            className=top_class if not is_unrelated else None,
            issueType=issue_type,
            confidence=top_confidence,
            entropy=entropy,
            message=message,
            allPredictions=all_predictions[:5],  # Top 5 predictions
        )

    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch image: {str(e)}")

    except Exception as e:
        print(f"Classification error: {e}")
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")


@app.post("/classify-file", response_model=ClassifyResponse)
async def classify_file(image: UploadFile = File(...)):
    """
    Classify an uploaded image file to identify municipal issues
    """
    global model, class_mapping

    try:
        # Ensure model is loaded
        model, class_mapping = load_classifier()

        img_bytes = await image.read()
        img_array = preprocess_image_from_bytes(img_bytes)

        # Check image quality BEFORE running ML model
        is_quality_valid, quality_reason = check_image_quality(img_array)
        if not is_quality_valid:
            return ClassifyResponse(
                success=True,
                isValid=False,
                isUnrelated=True,
                className=None,
                issueType=None,
                confidence=0,
                entropy=0,
                message=f"Invalid image: {quality_reason}. Please upload a clear photo of the municipal issue.",
                allPredictions=[],
            )

        # Run inference
        predictions = model.predict(img_array, verbose=0)[0]

        # Get top prediction
        top_idx = int(np.argmax(predictions))
        top_confidence = float(predictions[top_idx])
        top_class = class_mapping["index_to_class"][str(top_idx)]

        # Check if image is likely unrelated to municipal issues
        is_unrelated, unrelated_reason = is_likely_unrelated(predictions)
        entropy = calculate_entropy(predictions)

        # Get all predictions sorted by probability
        all_predictions = []
        for idx, prob in enumerate(predictions):
            class_name = class_mapping["index_to_class"][str(idx)]
            all_predictions.append(
                PredictionResult(
                    className=class_name,
                    probability=float(prob),
                    issueType=ML_CLASS_TO_ISSUE_TYPE.get(class_name),
                )
            )
        all_predictions.sort(key=lambda x: x.probability, reverse=True)

        # Determine if valid based on confidence AND unrelated check
        is_valid = top_confidence >= CONFIDENCE_THRESHOLD and not is_unrelated
        issue_type = ML_CLASS_TO_ISSUE_TYPE.get(top_class) if is_valid else None

        # Generate message
        if is_unrelated:
            message = (
                f"This image doesn't appear to show a municipal issue. "
                f"Reason: {unrelated_reason}. "
                f"Please upload a clear photo of the issue (pothole, garbage, vandalism, etc.)."
            )
        elif not is_valid:
            message = (
                f"Unable to confidently classify this image ({top_confidence*100:.0f}% confidence). "
                f"The image may not clearly show a municipal issue. "
                f"Please upload a clearer image or select the issue type manually."
            )
        elif top_confidence < WARNING_THRESHOLD:
            message = (
                f"Detected as '{top_class}' with {top_confidence*100:.0f}% confidence. "
                f"Please confirm this is the correct issue type."
            )
        else:
            message = (
                f"Detected as '{top_class}' with {top_confidence*100:.0f}% confidence."
            )

        return ClassifyResponse(
            success=True,
            isValid=is_valid,
            isUnrelated=is_unrelated,
            className=top_class if not is_unrelated else None,
            issueType=issue_type,
            confidence=top_confidence,
            entropy=entropy,
            message=message,
            allPredictions=all_predictions[:5],  # Top 5 predictions
        )

    except Exception as e:
        print(f"Classification error: {e}")
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")


@app.get("/issue-types", response_model=IssueTypesResponse)
async def get_issue_types():
    """Get list of all valid issue types"""
    return IssueTypesResponse(
        success=True,
        issueTypes=[
            IssueType(className=k, issueType=v)
            for k, v in ML_CLASS_TO_ISSUE_TYPE.items()
        ],
        count=len(ML_CLASS_TO_ISSUE_TYPE),
    )


@app.post("/generate-description", response_model=DescriptionResponse)
async def generate_description(request: GenerateDescriptionRequest):
    """
    Generate a description for a municipal issue image using AWS Bedrock.
    """
    try:
        if not request.imageUrl:
            raise HTTPException(status_code=400, detail="imageUrl is required")

        # Download the image
        img = download_image(request.imageUrl)

        # Convert to bytes for Bedrock
        img_buffer = BytesIO()
        img.save(img_buffer, format="JPEG")
        img_bytes = img_buffer.getvalue()

        # Create the prompt
        issue_type_name = {
            "POTHOLE": "pothole or road damage",
            "GARBAGE": "garbage or littering",
            "ILLEGAL_PARKING": "illegal parking",
            "DAMAGED_SIGN": "damaged road sign",
            "FALLEN_TREE": "fallen tree",
            "VANDALISM": "vandalism or graffiti",
            "DEAD_ANIMAL": "dead animal",
            "DAMAGED_CONCRETE": "damaged concrete structure",
            "DAMAGED_ELECTRICAL": "damaged electrical pole or wire",
        }.get(request.issueType, "municipal issue")

        prompt = f"""You are helping citizens report municipal issues.
Analyze this image showing a {issue_type_name} and write a brief, clear description (2-3 sentences) that would help municipal workers understand and locate the issue.

Include:
- What the issue looks like (size, severity if visible)
- Any notable details that would help workers identify or fix it
- Keep it factual and objective

Do NOT include:
- Location details (those are captured separately)
- Speculation about causes
- Demands or complaints

Just provide the description text, no quotes or prefixes."""

        # Generate description using AWS Bedrock
        region = os.environ.get("AWS_REGION", "us-east-1")
        model_id = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0")
        bedrock_client = boto3.client("bedrock-runtime", region_name=region)

        response = bedrock_client.converse(
            modelId=model_id,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "image": {
                                "format": "jpeg",
                                "source": {
                                    "bytes": img_bytes
                                }
                            }
                        },
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            inferenceConfig={
                "maxTokens": 300,
                "temperature": 0.3,
            }
        )

        description = response["output"]["message"]["content"][0]["text"].strip()

        return DescriptionResponse(success=True, description=description)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Description generation error: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate description: {str(e)}"
        )


# ============================================
# CLUSTERING ENDPOINTS
# ============================================

@app.post("/cluster", response_model=ClusterResponse)
async def cluster_issues(request: ClusterRequest):
    """
    Cluster nearby issues using DBSCAN algorithm.

    Groups issues within specified distance (default 50m) into clusters.
    Returns clusters with centroid, aggregate severity, and dominant issue type.
    """
    try:
        # Convert request issues to dict format
        issues_data = []
        for issue in request.issues:
            loc = issue.location
            lat = loc.latitude or loc.lat
            lng = loc.longitude or loc.lng

            if lat is None or lng is None:
                continue

            issues_data.append({
                "id": issue.id,
                "location": {
                    "latitude": lat,
                    "longitude": lng,
                },
                "type": issue.type,
                "severity": issue.severity,
            })

        # Get clustering service with requested parameters
        clustering_service = get_clustering_service(
            eps_meters=request.eps_meters,
            min_samples=request.min_samples
        )

        # Perform clustering
        result = clustering_service.cluster_issues(issues_data)

        return ClusterResponse(
            success=True,
            clusters=result["clusters"],
            unclustered=result["unclustered"],
            statistics=result["statistics"],
        )

    except Exception as e:
        print(f"Clustering error: {e}")
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")


# ============================================
# SEVERITY ENDPOINTS
# ============================================

@app.post("/predict-severity", response_model=SeverityResponse)
async def predict_severity(request: SeverityRequest):
    """
    Predict severity score (1-10) for an issue.

    Uses EfficientNet-B0 model if available, falls back to rule-based scoring.
    """
    try:
        severity_service = get_severity_service()

        result = severity_service.predict_from_image(
            image_url=request.imageUrl,
            issue_type=request.issueType,
        )

        return SeverityResponse(
            success=True,
            score=result["score"],
            level=result["level"],
            confidence=result["confidence"],
            factors=result["factors"],
            mlScore=result.get("mlScore"),
            ruleScore=result.get("ruleScore"),
        )

    except Exception as e:
        print(f"Severity prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Severity prediction failed: {str(e)}")


# ============================================
# RISK ENDPOINTS
# ============================================

@app.post("/predict-risk", response_model=RiskResponse)
async def predict_risk(request: RiskRequest):
    """
    Predict infrastructure risk score for a location.

    Uses XGBoost model based on weather, location, and historical factors.
    """
    try:
        risk_service = get_risk_service()

        result = risk_service.predict(
            latitude=request.latitude,
            longitude=request.longitude,
            rainfall_mm=request.rainfall_mm,
            temperature_c=request.temperature_c,
            humidity_pct=request.humidity_pct,
            road_type=request.road_type,
            traffic_density=request.traffic_density,
            issue_count_30d=request.issue_count_30d,
            is_hotspot=request.is_hotspot,
            resolution_rate=request.resolution_rate,
            days_since_last_issue=request.days_since_last_issue,
            population_density=request.population_density,
        )

        return RiskResponse(
            success=True,
            riskScore=result["riskScore"],
            riskLevel=result["riskLevel"],
            confidence=result["confidence"],
            factors=result["factors"],
            location=result["location"],
            weather=result["weather"],
        )

    except Exception as e:
        print(f"Risk prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Risk prediction failed: {str(e)}")


@app.post("/predict-risk-grid", response_model=RiskGridResponse)
async def predict_risk_grid(request: RiskGridRequest):
    """
    Predict risk scores for a grid of points within bounds.

    Useful for generating heatmap visualizations.
    """
    try:
        risk_service = get_risk_service()

        predictions = risk_service.predict_grid(
            bounds=request.bounds,
            grid_size=request.grid_size,
            weather=request.weather,
        )

        return RiskGridResponse(
            success=True,
            predictions=predictions,
            bounds=request.bounds,
            gridSize=request.grid_size,
        )

    except Exception as e:
        print(f"Risk grid prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Risk grid prediction failed: {str(e)}")


if __name__ == "__main__":
    port = int(os.environ.get("ML_API_PORT", 3002))
    print(f"\nStarting server on http://localhost:{port}")
    print("Endpoints:")
    print(f"  POST /classify - Classify an image via URL")
    print(f"  POST /classify-file - Classify an uploaded image file")
    print(f"  POST /generate-description - Generate issue description with AWS Bedrock")
    print(f"  POST /cluster - Cluster nearby issues (DBSCAN)")
    print(f"  POST /predict-severity - Predict issue severity (1-10)")
    print(f"  POST /predict-risk - Predict infrastructure risk")
    print(f"  POST /predict-risk-grid - Predict risk for grid (heatmap)")
    print(f"  GET  /issue-types - List valid issue types")
    print(f"  GET  /health - Health check")
    print(f"  GET  /docs - API documentation (Swagger UI)")
    print("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=port)
