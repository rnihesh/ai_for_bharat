"""
Cloudinary upload helper for Telegram photos
Downloads photos from Telegram and uploads them to Cloudinary
"""

import httpx
import hashlib
import time
from typing import Optional
from telegram import Bot

from config import config


async def get_cloudinary_signature() -> dict:
    """
    Get Cloudinary upload signature from the main server.

    Returns:
        Dict with signature data or empty dict on failure
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{config.services.main_server}/api/upload/signature",
            )
            response.raise_for_status()
            result = response.json()

            if result.get("success") and result.get("data"):
                return result["data"]
            else:
                print(f"[CloudinaryUpload] Signature response not successful: {result}")
                return {}

    except Exception as e:
        print(f"[CloudinaryUpload] Error getting signature: {e}")
        return {}


async def upload_telegram_photo(bot: Bot, file_id: str) -> Optional[str]:
    """
    Download a photo from Telegram and upload it to Cloudinary.

    Args:
        bot: Telegram Bot instance
        file_id: Telegram file ID for the photo

    Returns:
        Cloudinary secure_url or None if upload failed
    """
    try:
        # 1. Get file info from Telegram
        file = await bot.get_file(file_id)
        file_path = file.file_path

        if not file_path:
            print(f"[CloudinaryUpload] No file path for file_id: {file_id}")
            return None

        # 2. Download the file from Telegram
        print(f"[CloudinaryUpload] Downloading from Telegram: {file_path}")
        file_bytes = await file.download_as_bytearray()

        if not file_bytes:
            print(f"[CloudinaryUpload] Failed to download file: {file_id}")
            return None

        # 3. Get upload signature from main server
        print(f"[CloudinaryUpload] Getting signature...")
        sig_data = await get_cloudinary_signature()

        if not sig_data.get("signature"):
            print(f"[CloudinaryUpload] Failed to get signature: {sig_data}")
            return None

        # 4. Upload to Cloudinary
        cloud_name = sig_data.get("cloudName", "civiclemma")
        upload_url = f"https://api.cloudinary.com/v1_1/{cloud_name}/image/upload"

        print(f"[CloudinaryUpload] Uploading to Cloudinary (cloud: {cloud_name})...")

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Prepare multipart form data
            # Server provides folder in the signature, so we use that
            files = {"file": ("photo.jpg", bytes(file_bytes), "image/jpeg")}
            data = {
                "api_key": sig_data["apiKey"],
                "timestamp": str(sig_data["timestamp"]),
                "signature": sig_data["signature"],
                "folder": sig_data.get("folder", "civiclemma/issues"),
            }

            response = await client.post(upload_url, files=files, data=data)

            if response.status_code >= 400:
                print(f"[CloudinaryUpload] Upload failed: {response.status_code} - {response.text}")
                return None

            result = response.json()
            secure_url = result.get("secure_url")

            if secure_url:
                print(f"[CloudinaryUpload] Success: {secure_url}")
                return secure_url
            else:
                print(f"[CloudinaryUpload] No secure_url in response: {result}")
                return None

    except httpx.HTTPError as e:
        print(f"[CloudinaryUpload] HTTP error: {e}")
        return None
    except Exception as e:
        print(f"[CloudinaryUpload] Error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def upload_bytes_to_cloudinary(image_bytes: bytes) -> Optional[str]:
    """
    Upload raw image bytes to Cloudinary.

    Args:
        image_bytes: Raw image bytes

    Returns:
        Cloudinary secure_url or None if upload failed
    """
    try:
        # Get upload signature from main server
        sig_data = await get_cloudinary_signature()

        if not sig_data.get("signature"):
            print(f"[CloudinaryUpload] Failed to get signature")
            return None

        # Upload to Cloudinary
        cloud_name = sig_data.get("cloudName", "civiclemma")
        upload_url = f"https://api.cloudinary.com/v1_1/{cloud_name}/image/upload"

        async with httpx.AsyncClient(timeout=30.0) as client:
            files = {"file": ("photo.jpg", image_bytes, "image/jpeg")}
            data = {
                "api_key": sig_data["apiKey"],
                "timestamp": str(sig_data["timestamp"]),
                "signature": sig_data["signature"],
                "folder": sig_data.get("folder", "civiclemma/issues"),
            }

            response = await client.post(upload_url, files=files, data=data)
            response.raise_for_status()

            result = response.json()
            return result.get("secure_url")

    except Exception as e:
        print(f"[CloudinaryUpload] Error uploading bytes: {e}")
        return None
