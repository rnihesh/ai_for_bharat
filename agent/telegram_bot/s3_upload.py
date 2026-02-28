"""
S3 upload helper for Telegram photos
Downloads photos from Telegram and uploads them to S3 via presigned URLs
"""

import httpx
from typing import Optional
from telegram import Bot

from config import config


async def get_presigned_url(content_type: str = "image/jpeg") -> dict:
    """
    Get S3 presigned upload URL from the main server.

    Returns:
        Dict with upload URL data or empty dict on failure
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{config.services.main_server}/api/upload/presigned-url",
                json={"contentType": content_type},
            )
            response.raise_for_status()
            result = response.json()

            if result.get("success") and result.get("data"):
                return result["data"]
            else:
                print(f"[S3Upload] Presigned URL response not successful: {result}")
                return {}

    except Exception as e:
        print(f"[S3Upload] Error getting presigned URL: {e}")
        return {}


async def upload_telegram_photo(bot: Bot, file_id: str) -> Optional[str]:
    """
    Download a photo from Telegram and upload it to S3.

    Args:
        bot: Telegram Bot instance
        file_id: Telegram file ID for the photo

    Returns:
        Public URL (CloudFront/S3) or None if upload failed
    """
    try:
        # 1. Get file info from Telegram
        file = await bot.get_file(file_id)
        file_path = file.file_path

        if not file_path:
            print(f"[S3Upload] No file path for file_id: {file_id}")
            return None

        # 2. Download the file from Telegram
        print(f"[S3Upload] Downloading from Telegram: {file_path}")
        file_bytes = await file.download_as_bytearray()

        if not file_bytes:
            print(f"[S3Upload] Failed to download file: {file_id}")
            return None

        # 3. Get presigned upload URL from main server
        print(f"[S3Upload] Getting presigned URL...")
        url_data = await get_presigned_url("image/jpeg")

        if not url_data.get("uploadUrl"):
            print(f"[S3Upload] Failed to get presigned URL: {url_data}")
            return None

        upload_url = url_data["uploadUrl"]
        public_url = url_data.get("publicUrl", "")

        # 4. Upload to S3 using presigned URL
        print(f"[S3Upload] Uploading to S3...")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(
                upload_url,
                content=bytes(file_bytes),
                headers={"Content-Type": "image/jpeg"},
            )

            if response.status_code >= 400:
                print(f"[S3Upload] Upload failed: {response.status_code} - {response.text}")
                return None

            print(f"[S3Upload] Success: {public_url}")
            return public_url

    except httpx.HTTPError as e:
        print(f"[S3Upload] HTTP error: {e}")
        return None
    except Exception as e:
        print(f"[S3Upload] Error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def upload_bytes_to_s3(image_bytes: bytes) -> Optional[str]:
    """
    Upload raw image bytes to S3.

    Args:
        image_bytes: Raw image bytes

    Returns:
        Public URL (CloudFront/S3) or None if upload failed
    """
    try:
        # Get presigned upload URL from main server
        url_data = await get_presigned_url("image/jpeg")

        if not url_data.get("uploadUrl"):
            print(f"[S3Upload] Failed to get presigned URL")
            return None

        upload_url = url_data["uploadUrl"]
        public_url = url_data.get("publicUrl", "")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.put(
                upload_url,
                content=image_bytes,
                headers={"Content-Type": "image/jpeg"},
            )
            response.raise_for_status()

            return public_url

    except Exception as e:
        print(f"[S3Upload] Error uploading bytes: {e}")
        return None
