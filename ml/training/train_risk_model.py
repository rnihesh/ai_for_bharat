"""
Train XGBoost Risk Prediction Model

Trains an XGBoost regressor to predict infrastructure risk scores
based on weather, location, and historical factors.
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb
import joblib


# Feature columns (excluding target)
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

TARGET_COLUMN = "risk_score"


def load_training_data(data_path: Path) -> pd.DataFrame:
    """
    Load training data from JSON file.

    Args:
        data_path: Path to training data JSON

    Returns:
        DataFrame with features and target
    """
    with open(data_path, "r") as f:
        data = json.load(f)

    return pd.DataFrame(data)


def train_model():
    """Train XGBoost risk model and save artifacts."""
    models_dir = Path(__file__).parent.parent / "models"
    models_dir.mkdir(exist_ok=True)

    data_path = models_dir / "risk_training_data.json"

    # Check if training data exists
    if not data_path.exists():
        print("Training data not found. Generating...")
        from generate_risk_data import main as generate_data
        generate_data()

    print("Loading training data...")
    df = load_training_data(data_path)

    print(f"Total samples: {len(df)}")

    # Prepare features and target
    X = df[FEATURE_COLUMNS].values
    y = df[TARGET_COLUMN].values

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print(f"Training samples: {len(X_train)}")
    print(f"Test samples: {len(X_test)}")

    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train XGBoost model
    print("\nTraining XGBoost model...")
    model = xgb.XGBRegressor(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
    )

    model.fit(
        X_train_scaled, y_train,
        eval_set=[(X_test_scaled, y_test)],
        verbose=True
    )

    # Evaluate
    print("\nEvaluating model...")
    y_pred = model.predict(X_test_scaled)

    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print(f"\nTest Metrics:")
    print(f"  RMSE: {rmse:.4f}")
    print(f"  MAE:  {mae:.4f}")
    print(f"  R²:   {r2:.4f}")

    # Feature importance
    print("\nFeature Importance:")
    importance = dict(zip(FEATURE_COLUMNS, model.feature_importances_))
    sorted_importance = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    for feature, imp in sorted_importance:
        print(f"  {feature}: {imp:.4f}")

    # Save model and scaler
    model_path = models_dir / "risk_model.joblib"
    scaler_path = models_dir / "risk_scaler.joblib"

    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)

    print(f"\nModel saved to: {model_path}")
    print(f"Scaler saved to: {scaler_path}")

    # Save metrics
    metrics = {
        "rmse": float(rmse),
        "mae": float(mae),
        "r2": float(r2),
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "feature_importance": {k: float(v) for k, v in importance.items()},
        "model_params": model.get_params(),
    }

    metrics_path = models_dir / "risk_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"Metrics saved to: {metrics_path}")

    # Save feature columns for inference
    config = {
        "feature_columns": FEATURE_COLUMNS,
        "target_column": TARGET_COLUMN,
    }
    config_path = models_dir / "risk_model_config.json"
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)

    return model, scaler, metrics


if __name__ == "__main__":
    train_model()
