"""
Firebase Firestore → DynamoDB Migration Script for CivicLemma

Usage:
  1. Place your Firebase serviceAccountKey.json in the same directory
  2. Set AWS credentials via env vars or IAM role
  3. pip install firebase-admin boto3
  4. python migrate_firebase_to_dynamodb.py [--dry-run] [--export-only] [--import-only]

Options:
  --dry-run      Preview what will be migrated without writing
  --export-only  Only export from Firestore to JSON files
  --import-only  Only import from JSON files to DynamoDB (requires prior export)
"""

import json
import os
import sys
import argparse
from datetime import datetime
from pathlib import Path

# Firebase
import firebase_admin
from firebase_admin import credentials, firestore

# AWS
import boto3
from boto3.dynamodb.types import TypeSerializer

# ─── Configuration ───────────────────────────────────────────────────────────

FIREBASE_SA_KEY = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
TABLE_PREFIX = os.getenv("DYNAMODB_TABLE_PREFIX", "civiclemma_")
EXPORT_DIR = Path("migration_export")

# Firestore collection → DynamoDB table + key field mapping
COLLECTION_MAP = {
    "issues": {
        "table": f"{TABLE_PREFIX}issues",
        "id_field": "issueId",
        "add_pk": True,          # Add _pk="ALL" for global GSIs
        "add_latitude": True,    # Copy location.latitude to top-level
    },
    "municipalities": {
        "table": f"{TABLE_PREFIX}municipalities",
        "id_field": "municipalityId",
        "add_pk": True,
    },
    "users": {
        "table": f"{TABLE_PREFIX}users",
        "id_field": "uid",
    },
    "score_history": {
        "table": f"{TABLE_PREFIX}score_history",
        "id_field": "municipalityId",  # Composite key: municipalityId + timestamp
    },
    "verifications": {
        "table": f"{TABLE_PREFIX}verifications",
        "id_field": "verificationId",
    },
    "municipality_registrations": {
        "table": f"{TABLE_PREFIX}municipality_registrations",
        "id_field": "registrationId",
    },
    "location_stats": {
        "table": f"{TABLE_PREFIX}location_stats",
        "id_field": "locationKey",
    },
}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def convert_timestamps(obj):
    """Recursively convert Firestore Timestamp objects to ISO 8601 strings."""
    if obj is None:
        return None
    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, 'timestamp') and callable(obj.timestamp):
        # Firestore Timestamp
        return obj.isoformat() if hasattr(obj, 'isoformat') else str(obj)
    if hasattr(obj, '_seconds'):
        # Raw Firestore Timestamp
        return datetime.utcfromtimestamp(obj._seconds).isoformat() + "Z"
    if isinstance(obj, dict):
        return {k: convert_timestamps(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_timestamps(item) for item in obj]
    return obj


def clean_for_dynamodb(item):
    """Remove None values and empty strings (DynamoDB doesn't accept them)."""
    if isinstance(item, dict):
        cleaned = {}
        for k, v in item.items():
            v = clean_for_dynamodb(v)
            if v is None:
                continue
            if isinstance(v, str) and v == "":
                continue
            if isinstance(v, bool):
                pass  # Keep bools as-is (bool is subclass of int)
            elif isinstance(v, float):
                v = round(v, 6)  # Avoid float precision issues
                from decimal import Decimal
                v = Decimal(str(v))
            elif isinstance(v, int):
                from decimal import Decimal
                v = Decimal(str(v))
            cleaned[k] = v
        return cleaned
    if isinstance(item, list):
        return [clean_for_dynamodb(i) for i in item]
    return item


# ─── Export from Firestore ───────────────────────────────────────────────────

def export_firestore():
    """Export all Firestore collections to JSON files."""
    print("\n📦 Initializing Firebase...")
    cred = credentials.Certificate(FIREBASE_SA_KEY)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    EXPORT_DIR.mkdir(exist_ok=True)
    stats = {}

    for collection_name, config in COLLECTION_MAP.items():
        print(f"\n📥 Exporting '{collection_name}'...")
        id_field = config["id_field"]

        try:
            docs = db.collection(collection_name).stream()
            items = []
            for doc in docs:
                data = doc.to_dict()
                data = convert_timestamps(data)

                # Map Firestore document ID to explicit key field
                if collection_name == "score_history":
                    # Composite key - doc ID might encode municipalityId
                    if "municipalityId" not in data:
                        data["municipalityId"] = doc.id.split("_")[0] if "_" in doc.id else doc.id
                    if "timestamp" not in data:
                        data["timestamp"] = data.get("createdAt", datetime.utcnow().isoformat() + "Z")
                else:
                    data[id_field] = doc.id

                # Add synthetic _pk for global GSIs
                if config.get("add_pk"):
                    data["_pk"] = "ALL"

                # Copy nested latitude to top-level for GSI
                if config.get("add_latitude"):
                    loc = data.get("location", {})
                    if loc and isinstance(loc, dict) and "latitude" in loc:
                        data["latitude"] = loc["latitude"]

                # Normalize lastLogin → lastLoginAt
                if collection_name == "users":
                    if "lastLogin" in data and "lastLoginAt" not in data:
                        data["lastLoginAt"] = data.pop("lastLogin")

                items.append(data)

            output_file = EXPORT_DIR / f"{collection_name}.json"
            with open(output_file, "w") as f:
                json.dump(items, f, indent=2, default=str)

            stats[collection_name] = len(items)
            print(f"  ✅ Exported {len(items)} documents → {output_file}")

        except Exception as e:
            print(f"  ❌ Error exporting '{collection_name}': {e}")
            stats[collection_name] = f"ERROR: {e}"

    print("\n📊 Export Summary:")
    for coll, count in stats.items():
        print(f"  {coll}: {count}")

    return stats


# ─── Import to DynamoDB ──────────────────────────────────────────────────────

def import_to_dynamodb(dry_run=False):
    """Import JSON files into DynamoDB tables."""
    print(f"\n🚀 Connecting to DynamoDB (region: {AWS_REGION})...")
    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    stats = {}

    for collection_name, config in COLLECTION_MAP.items():
        table_name = config["table"]
        input_file = EXPORT_DIR / f"{collection_name}.json"

        if not input_file.exists():
            print(f"\n⚠️  Skipping '{collection_name}' - no export file found")
            continue

        with open(input_file) as f:
            items = json.load(f)

        if not items:
            print(f"\n⚠️  Skipping '{collection_name}' - empty")
            continue

        print(f"\n📤 Importing {len(items)} items → {table_name}...")

        if dry_run:
            print(f"  🔍 [DRY RUN] Would write {len(items)} items")
            print(f"  Sample item keys: {list(items[0].keys())[:8]}...")
            stats[collection_name] = f"{len(items)} (dry run)"
            continue

        table = dynamodb.Table(table_name)
        success_count = 0
        error_count = 0

        # Use batch_writer for efficient writes
        try:
            with table.batch_writer() as batch:
                for i, item in enumerate(items):
                    try:
                        cleaned = clean_for_dynamodb(item)
                        batch.put_item(Item=cleaned)
                        success_count += 1
                        if (i + 1) % 50 == 0:
                            print(f"  Progress: {i + 1}/{len(items)}")
                    except Exception as e:
                        error_count += 1
                        print(f"  ❌ Error writing item {i}: {e}")
                        if error_count > 10:
                            print("  ⛔ Too many errors, stopping this table")
                            break
        except Exception as e:
            print(f"  ❌ Table error: {e}")

        stats[collection_name] = f"{success_count} ok, {error_count} errors"
        print(f"  ✅ {success_count} written, {error_count} errors")

    print("\n📊 Import Summary:")
    for coll, result in stats.items():
        print(f"  {coll}: {result}")

    return stats


# ─── Verify Migration ────────────────────────────────────────────────────────

def verify_migration():
    """Compare counts between export files and DynamoDB tables."""
    print("\n🔍 Verifying migration...")
    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)

    for collection_name, config in COLLECTION_MAP.items():
        table_name = config["table"]
        input_file = EXPORT_DIR / f"{collection_name}.json"

        if not input_file.exists():
            continue

        with open(input_file) as f:
            export_count = len(json.load(f))

        try:
            table = dynamodb.Table(table_name)
            dynamo_count = table.item_count  # Eventually consistent
            response = table.scan(Select="COUNT")
            actual_count = response["Count"]

            match = "✅" if actual_count == export_count else "❌ MISMATCH"
            print(f"  {collection_name}: export={export_count}, dynamo={actual_count} {match}")
        except Exception as e:
            print(f"  {collection_name}: export={export_count}, dynamo=ERROR ({e})")


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Migrate CivicLemma from Firestore to DynamoDB")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DynamoDB")
    parser.add_argument("--export-only", action="store_true", help="Only export from Firestore")
    parser.add_argument("--import-only", action="store_true", help="Only import to DynamoDB")
    parser.add_argument("--verify", action="store_true", help="Verify migration counts")
    args = parser.parse_args()

    print("=" * 60)
    print("  CivicLemma: Firestore → DynamoDB Migration")
    print("=" * 60)

    if args.verify:
        verify_migration()
        return

    if not args.import_only:
        if not Path(FIREBASE_SA_KEY).exists():
            print(f"\n❌ Firebase service account key not found: {FIREBASE_SA_KEY}")
            print("  Copy from data-dynamo/server/serviceAccountKey.json")
            sys.exit(1)
        export_firestore()

    if not args.export_only:
        import_to_dynamodb(dry_run=args.dry_run)
        if not args.dry_run:
            verify_migration()

    print("\n✅ Migration complete!")
    if not args.export_only:
        print("\n⚠️  NEXT STEPS:")
        print("  1. Migrate Firebase Auth users to Cognito (see MIGRATION.md)")
        print("  2. If images are on Cloudinary, optionally re-upload to S3")
        print("  3. Test all API endpoints with the new DynamoDB backend")


if __name__ == "__main__":
    main()
