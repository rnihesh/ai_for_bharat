# ML Service Documentation

## Overview

The ML service provides AI-powered features for CivicLemma:

1. **Image Classification** - Identifies issue types from photos
2. **Severity Scoring** - Rates issue severity (1-10 scale)
3. **Issue Clustering** - Groups nearby issues using DBSCAN
4. **Risk Prediction** - Predicts infrastructure risk based on weather/location

---

## Quick Start

```bash
# From project root
cd ml

# Activate virtual environment
source .venv/bin/activate

# Start the service
python -m uvicorn main:app --reload --port 8000

# View API docs
open http://localhost:8000/docs
```

---

## Models

### 1. Image Classification (MobileNetV2)

**File:** `models/best_model.keras`

**Purpose:** Classifies uploaded images into 9 issue categories

**Input:** 224x224 RGB image

**Output:** Issue type + confidence score

| Issue Type | Description |
|------------|-------------|
| POTHOLE | Road damage, potholes |
| GARBAGE | Littering, waste |
| ILLEGAL_PARKING | Parking violations |
| DAMAGED_SIGN | Broken road signs |
| FALLEN_TREE | Trees blocking roads |
| VANDALISM | Graffiti, property damage |
| DEAD_ANIMAL | Animal carcasses |
| DAMAGED_CONCRETE | Broken sidewalks/structures |
| DAMAGED_ELECTRICAL | Broken poles/wires |

**Thresholds:**
- `CONFIDENCE_THRESHOLD = 0.70` - Minimum to accept
- `WARNING_THRESHOLD = 0.85` - Below this, show warning
- `ENTROPY_THRESHOLD = 1.5` - High entropy = unrelated image

---

### 2. Severity Scorer (EfficientNet-B0)

**File:** `models/severity_model.keras`

**Purpose:** Predicts severity score from image + issue type

**Input:** Image URL + Issue Type

**Output:** Score (1-10), Level (CRITICAL/HIGH/MEDIUM/LOW)

**Training Data:** 1000 synthetic samples with rule-based labels

**Metrics:**
- MAE: ~1.9 (predicts within 2 points)
- MSE: 0.062

**Severity Levels:**
| Score | Level |
|-------|-------|
| 8-10 | CRITICAL |
| 6-7.9 | HIGH |
| 4-5.9 | MEDIUM |
| 1-3.9 | LOW |

**Base Severity by Type:**
```python
SEVERITY_WEIGHTS = {
    "DAMAGED_ELECTRICAL": 9,  # Safety hazard
    "FALLEN_TREE": 8,         # Road blockage
    "DEAD_ANIMAL": 7,         # Health hazard
    "POTHOLE": 6,             # Vehicle damage
    "DAMAGED_CONCRETE": 6,
    "DAMAGED_SIGN": 5,
    "GARBAGE": 4,
    "ILLEGAL_PARKING": 3,
    "VANDALISM": 3,
}
```

---

### 3. DBSCAN Clustering

**File:** `services/clustering.py` (no model file - unsupervised)

**Purpose:** Groups nearby issues into clusters for map visualization

**Algorithm:** DBSCAN with Haversine distance

**Parameters:**
- `eps_meters = 50` - Cluster radius in meters
- `min_samples = 2` - Minimum issues per cluster

**Input:** List of issues with lat/lng coordinates

**Output:**
```json
{
  "clusters": [
    {
      "id": "cluster_0",
      "centroid": { "latitude": 17.385, "longitude": 78.486 },
      "issueCount": 5,
      "aggregateSeverity": 7.2,
      "severityLevel": "HIGH",
      "dominantType": "POTHOLE",
      "radiusMeters": 45.3,
      "issueIds": ["id1", "id2", "id3", "id4", "id5"]
    }
  ],
  "unclustered": [...],
  "statistics": {
    "totalIssues": 100,
    "clusteredIssues": 45,
    "clusterCount": 12
  }
}
```

---

### 4. Risk Predictor (XGBoost)

**File:** `models/risk_model.joblib` (if trained)

**Purpose:** Predicts infrastructure risk for a location

**Status:** Requires training (needs `libomp` on Mac)

**To Train:**
```bash
brew install libomp  # Mac only
cd ml
source .venv/bin/activate
python training/train_risk_model.py
```

**Features (15 total):**
| Feature | Description |
|---------|-------------|
| latitude, longitude | Location |
| rainfall_mm | Current rainfall |
| temperature_c | Temperature |
| humidity_pct | Humidity |
| is_monsoon | Monsoon season flag |
| road_type | highway/urban/rural |
| traffic_density | 0-1 scale |
| issue_count_30d | Recent issues nearby |
| is_hotspot | High-issue area flag |
| resolution_rate | Area resolution rate |
| days_since_last_issue | Recency |
| population_density | Area density |

**Output:** Risk score (0-1), Risk level (CRITICAL/HIGH/MEDIUM/LOW)

---

## API Endpoints

### Health Check
```bash
GET /health
```

### Image Classification
```bash
POST /classify
{
  "imageUrl": "https://..."
}

# Response
{
  "success": true,
  "isValid": true,
  "className": "Potholes and Road Damage",
  "issueType": "POTHOLE",
  "confidence": 0.92
}
```

### Severity Prediction
```bash
POST /predict-severity
{
  "imageUrl": "https://...",
  "issueType": "POTHOLE"
}

# Response
{
  "success": true,
  "score": 6.5,
  "level": "HIGH",
  "confidence": 0.85
}
```

### Issue Clustering
```bash
POST /cluster
{
  "issues": [
    {"id": "1", "location": {"latitude": 17.385, "longitude": 78.486}},
    {"id": "2", "location": {"latitude": 17.386, "longitude": 78.487}}
  ],
  "eps_meters": 50,
  "min_samples": 2
}
```

### Risk Prediction
```bash
POST /predict-risk
{
  "latitude": 17.385,
  "longitude": 78.486,
  "rainfall_mm": 50,
  "temperature_c": 28
}
```

### Risk Grid (for Heatmap)
```bash
POST /predict-risk-grid
{
  "bounds": {
    "north": 17.5,
    "south": 17.3,
    "east": 78.6,
    "west": 78.4
  },
  "grid_size": 10
}
```

---

## Where ML is Used

### 1. Issue Submission (`/report` page)
- Image classification to identify issue type
- Severity scoring for priority

### 2. Map Page (`/map`)
- **Cluster View:** Groups nearby issues (toggle button)
- **Risk Heatmap:** Shows predicted risk areas (toggle button)

### 3. Admin Dashboard (`/admin/dashboard`)
- ML service health status indicator

### 4. Server Routes
- `POST /api/ml/cluster` - Clustering endpoint
- `POST /api/ml/predict-severity` - Severity endpoint
- `POST /api/ml/predict-risk` - Risk endpoint
- `POST /api/ml/predict-risk-grid` - Heatmap endpoint
- `GET /api/ml/health` - Health check

---

## File Structure

```
ml/
├── main.py                 # FastAPI app with all endpoints
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (AWS_REGION, BEDROCK_MODEL_ID)
│
├── models/
│   ├── best_model.keras          # MobileNetV2 classifier
│   ├── class_mapping.json        # Class index mapping
│   ├── severity_model.keras      # EfficientNet severity scorer
│   ├── severity_metrics.json     # Training metrics
│   ├── risk_model.joblib         # XGBoost risk model (if trained)
│   ├── risk_scaler.joblib        # Feature scaler (if trained)
│   └── evaluation_report.json    # Model evaluation summary
│
├── services/
│   ├── clustering.py       # DBSCAN clustering service
│   ├── severity.py         # Severity prediction service
│   └── risk.py             # Risk prediction service
│
└── training/
    ├── generate_severity_data.py   # Generate synthetic severity labels
    ├── generate_risk_data.py       # Generate synthetic risk data
    ├── train_severity_model.py     # Train EfficientNet
    ├── train_risk_model.py         # Train XGBoost
    └── evaluate_models.py          # Generate metrics report
```

---

## Environment Variables

Create `ml/.env`:
```
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
ML_API_PORT=8000
```

---

## Troubleshooting

### "XGBoost Library could not be loaded"
```bash
# Mac only - install libomp
brew install libomp
```

### "Model not found"
```bash
# Models should be in ml/models/
ls ml/models/
# Should see: best_model.keras, severity_model.keras
```

### "Port 8000 already in use"
```bash
# Kill existing process
lsof -ti:8000 | xargs kill -9
```

---

## Training New Models

### Retrain Severity Model
```bash
cd ml
source .venv/bin/activate
python training/generate_severity_data.py
python training/train_severity_model.py
```

### Train Risk Model
```bash
brew install libomp  # Mac only
cd ml
source .venv/bin/activate
python training/generate_risk_data.py
python training/train_risk_model.py
```

### Generate Evaluation Report
```bash
python training/evaluate_models.py
cat models/evaluation_report.json
```
