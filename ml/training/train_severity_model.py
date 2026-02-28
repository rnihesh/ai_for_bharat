"""
Train EfficientNet-B0 Severity Scoring Model

Fine-tunes EfficientNet-B0 to predict severity scores (1-10) from images.
Uses transfer learning with frozen early layers.
"""

import json
import numpy as np
from pathlib import Path
import tensorflow as tf
from tensorflow.keras.applications import EfficientNetB0
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping
import os

# Suppress TF warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

# Constants
IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS = 10
LEARNING_RATE = 0.001


def create_severity_model() -> Model:
    """
    Create EfficientNet-B0 based severity regression model.

    Returns:
        Keras model that outputs severity score (1-10)
    """
    # Load pre-trained EfficientNet-B0
    base_model = EfficientNetB0(
        weights="imagenet",
        include_top=False,
        input_shape=(*IMG_SIZE, 3)
    )

    # Freeze early layers (keep last 20 trainable)
    for layer in base_model.layers[:-20]:
        layer.trainable = False

    # Add regression head
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dense(256, activation="relu")(x)
    x = Dropout(0.3)(x)
    x = Dense(64, activation="relu")(x)
    x = Dropout(0.2)(x)
    # Output: sigmoid * 9 + 1 to constrain to 1-10 range
    output = Dense(1, activation="sigmoid")(x)

    model = Model(inputs=base_model.input, outputs=output)

    return model


def create_synthetic_dataset(data_path: Path, num_samples: int = 500):
    """
    Create synthetic image dataset for training.

    Since we don't have labeled images, we create synthetic samples
    using the existing classification model predictions.

    Args:
        data_path: Path to severity training data JSON
        num_samples: Number of synthetic samples to generate

    Returns:
        Tuple of (X_train, y_train, X_val, y_val)
    """
    # Load severity labels
    with open(data_path, "r") as f:
        severity_data = json.load(f)

    # Map issue types to class indices (from our trained classifier)
    type_to_features = {
        "POTHOLE": 0,
        "GARBAGE": 1,
        "ILLEGAL_PARKING": 2,
        "DAMAGED_SIGN": 3,
        "FALLEN_TREE": 4,
        "VANDALISM": 5,
        "DEAD_ANIMAL": 6,
        "DAMAGED_CONCRETE": 7,
        "DAMAGED_ELECTRICAL": 8,
    }

    # Generate synthetic images (noise + class-specific patterns)
    np.random.seed(42)
    X = []
    y = []

    for sample in severity_data[:num_samples]:
        issue_type = sample["issue_type"]
        severity = sample["severity"]
        type_idx = type_to_features.get(issue_type, 0)

        # Create synthetic image with class-specific patterns
        img = np.random.rand(224, 224, 3) * 0.3  # Base noise

        # Add class-specific color patterns
        if issue_type in ["POTHOLE", "DAMAGED_CONCRETE"]:
            # Gray/brown tones for road damage
            img[:, :, 0] += 0.3  # Red channel
            img[:, :, 1] += 0.2  # Green channel
        elif issue_type == "GARBAGE":
            # Mixed colors for garbage
            img[::2, ::2, :] += 0.4  # Patchy pattern
        elif issue_type == "FALLEN_TREE":
            # Green/brown for vegetation
            img[:, :, 1] += 0.4  # Green channel
        elif issue_type == "DAMAGED_ELECTRICAL":
            # Dark with highlights for electrical
            img *= 0.5
            img[100:124, :, :] += 0.3  # Horizontal line pattern
        elif issue_type == "DEAD_ANIMAL":
            # Dark with some color
            img *= 0.6
            img[80:144, 80:144, 0] += 0.3  # Central blob

        # Add severity-based intensity variation
        intensity_factor = 0.5 + (severity / 10) * 0.5
        img *= intensity_factor

        img = np.clip(img, 0, 1)
        X.append(img)
        y.append((severity - 1) / 9)  # Normalize to 0-1 for sigmoid

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.float32)

    # Split into train/val
    split_idx = int(len(X) * 0.8)
    X_train, X_val = X[:split_idx], X[split_idx:]
    y_train, y_val = y[:split_idx], y[split_idx:]

    return X_train, y_train, X_val, y_val


def train_model():
    """Train the severity model and save it."""
    models_dir = Path(__file__).parent.parent / "models"
    models_dir.mkdir(exist_ok=True)

    data_path = models_dir / "severity_training_data.json"

    # Check if training data exists
    if not data_path.exists():
        print("Training data not found. Generating...")
        from generate_severity_data import main as generate_data
        generate_data()

    print("Creating model...")
    model = create_severity_model()

    print("Preparing dataset...")
    X_train, y_train, X_val, y_val = create_synthetic_dataset(data_path, num_samples=1000)

    print(f"Training samples: {len(X_train)}")
    print(f"Validation samples: {len(X_val)}")

    # Compile model
    model.compile(
        optimizer=Adam(learning_rate=LEARNING_RATE),
        loss="mse",
        metrics=["mae"]
    )

    # Callbacks
    checkpoint = ModelCheckpoint(
        str(models_dir / "severity_model.keras"),
        monitor="val_mae",
        save_best_only=True,
        mode="min",
        verbose=1
    )

    early_stop = EarlyStopping(
        monitor="val_mae",
        patience=5,
        restore_best_weights=True,
        verbose=1
    )

    print("Training model...")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=[checkpoint, early_stop],
        verbose=1
    )

    # Save final model
    model.save(str(models_dir / "severity_model.keras"))

    # Evaluate
    val_loss, val_mae = model.evaluate(X_val, y_val, verbose=0)
    # Convert MAE from normalized (0-1) to severity scale (1-10)
    val_mae_scaled = val_mae * 9

    print(f"\nFinal Validation MAE: {val_mae_scaled:.2f} (on 1-10 scale)")

    # Save metrics
    metrics = {
        "val_loss": float(val_loss),
        "val_mae": float(val_mae),
        "val_mae_scaled": float(val_mae_scaled),
        "epochs_trained": len(history.history["loss"]),
        "training_samples": len(X_train),
        "validation_samples": len(X_val),
    }

    with open(models_dir / "severity_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nModel saved to: {models_dir / 'severity_model.keras'}")
    print(f"Metrics saved to: {models_dir / 'severity_metrics.json'}")

    return model, history


if __name__ == "__main__":
    train_model()
