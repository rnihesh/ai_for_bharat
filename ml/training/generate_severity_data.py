"""
Generate Synthetic Severity Labels for Training

Creates severity scores (1-10) based on issue type and random variation.
Uses existing classification model predictions as features.
"""

import json
import random
from pathlib import Path
from typing import Dict, List, Tuple

# Base severity by issue type
BASE_SEVERITY = {
    "DAMAGED_ELECTRICAL": 9,  # Safety hazard
    "FALLEN_TREE": 8,         # Road blockage, safety
    "DEAD_ANIMAL": 7,         # Health hazard
    "POTHOLE": 6,             # Vehicle damage, accidents
    "DAMAGED_CONCRETE": 6,    # Structural safety
    "DAMAGED_SIGN": 5,        # Navigation safety
    "GARBAGE": 4,             # Health, aesthetics
    "ILLEGAL_PARKING": 3,     # Traffic flow
    "VANDALISM": 3,           # Aesthetics, property
}

# ML class names to issue types
ML_CLASS_TO_TYPE = {
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


def generate_severity_label(
    issue_type: str,
    confidence: float = 1.0,
    add_noise: bool = True
) -> Tuple[float, str]:
    """
    Generate a severity score for an issue.

    Args:
        issue_type: The type of issue (e.g., POTHOLE, GARBAGE)
        confidence: Classification confidence (0-1)
        add_noise: Whether to add random variation

    Returns:
        Tuple of (severity_score, reasoning)
    """
    base = BASE_SEVERITY.get(issue_type, 5)

    # Add random variation (-1.5 to +1.5)
    if add_noise:
        variation = random.uniform(-1.5, 1.5)
    else:
        variation = 0

    # Adjust for confidence (lower confidence = slightly lower severity)
    confidence_adjustment = (confidence - 0.7) * 2  # Range: -0.6 to +0.6

    # Calculate final score
    score = base + variation + confidence_adjustment
    score = max(1, min(10, score))  # Clamp to 1-10
    score = round(score, 1)

    # Generate reasoning
    severity_factors = []
    if base >= 8:
        severity_factors.append("high safety risk")
    elif base >= 6:
        severity_factors.append("moderate safety concern")
    elif base >= 4:
        severity_factors.append("quality of life impact")
    else:
        severity_factors.append("minor inconvenience")

    if variation > 1:
        severity_factors.append("appears severe from image")
    elif variation < -1:
        severity_factors.append("appears minor from image")

    reasoning = f"{issue_type.replace('_', ' ').title()}: {', '.join(severity_factors)}"

    return score, reasoning


def generate_training_data(num_samples: int = 2000) -> List[Dict]:
    """
    Generate synthetic severity training data.

    Args:
        num_samples: Number of samples to generate

    Returns:
        List of training samples with issue_type, confidence, severity, reasoning
    """
    data = []
    issue_types = list(BASE_SEVERITY.keys())

    for _ in range(num_samples):
        issue_type = random.choice(issue_types)
        confidence = random.uniform(0.5, 1.0)
        severity, reasoning = generate_severity_label(issue_type, confidence)

        data.append({
            "issue_type": issue_type,
            "confidence": round(confidence, 3),
            "severity": severity,
            "reasoning": reasoning,
        })

    return data


def main():
    """Generate and save severity training data."""
    output_dir = Path(__file__).parent.parent / "models"
    output_dir.mkdir(exist_ok=True)

    print("Generating severity training data...")
    data = generate_training_data(2000)

    # Save training data
    output_path = output_dir / "severity_training_data.json"
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Generated {len(data)} samples")
    print(f"Saved to: {output_path}")

    # Print distribution
    print("\nSeverity distribution:")
    from collections import Counter
    severity_bins = Counter(int(d["severity"]) for d in data)
    for severity in sorted(severity_bins.keys()):
        print(f"  {severity}: {severity_bins[severity]}")

    print("\nIssue type distribution:")
    type_dist = Counter(d["issue_type"] for d in data)
    for issue_type, count in type_dist.most_common():
        print(f"  {issue_type}: {count}")


if __name__ == "__main__":
    main()
