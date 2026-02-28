"""
Whisper Speech-to-Text Service
Supports both Azure Whisper and OpenAI Whisper
"""

import httpx
from typing import Optional, Tuple
from config import config


class WhisperService:
    """Whisper STT client - supports Azure and OpenAI"""

    def __init__(self):
        self.use_azure = config.whisper.use_azure

    @property
    def is_configured(self) -> bool:
        return config.whisper.is_configured

    def _get_azure_headers(self) -> dict:
        """Get Azure API request headers"""
        return {
            "api-key": config.whisper.azure_api_key,
        }

    def _get_openai_headers(self) -> dict:
        """Get OpenAI API request headers"""
        return {
            "Authorization": f"Bearer {config.whisper.openai_api_key}",
        }

    async def transcribe(
        self,
        audio_data: bytes,
        content_type: str = "audio/webm",
        language: str = "en",
        prompt: Optional[str] = None,
    ) -> Tuple[str, float]:
        """
        Transcribe audio to text

        Args:
            audio_data: Audio bytes
            content_type: MIME type of audio
            language: Language code
            prompt: Optional context prompt

        Returns:
            Tuple of (transcription text, confidence score)
        """
        if not self.is_configured:
            raise ValueError("Whisper STT is not configured - use browser fallback")

        if self.use_azure:
            return await self._transcribe_azure(audio_data, content_type, language)
        else:
            return await self._transcribe_openai(audio_data, content_type, language, prompt)

    async def _transcribe_azure(
        self,
        audio_data: bytes,
        content_type: str,
        language: str,
    ) -> Tuple[str, float]:
        """Transcribe using Azure Whisper"""
        # Determine file extension from content type
        ext_map = {
            "audio/webm": "webm",
            "audio/mp3": "mp3",
            "audio/mpeg": "mp3",
            "audio/wav": "wav",
            "audio/m4a": "m4a",
            "audio/ogg": "ogg",
        }
        extension = ext_map.get(content_type, "webm")

        # Azure expects the file in multipart form
        files = {
            "file": (f"audio.{extension}", audio_data, content_type),
        }

        # Azure Whisper endpoint already contains the full path
        endpoint = config.whisper.azure_endpoint

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                endpoint,
                headers=self._get_azure_headers(),
                files=files,
            )
            response.raise_for_status()

            # Azure returns different format - might be just text or JSON
            try:
                data = response.json()
                text = data.get("text", "")
            except Exception:
                # If it's plain text response
                text = response.text

        # Azure doesn't return confidence, estimate based on response
        confidence = 0.9 if text else 0.0

        return text, confidence

    async def _transcribe_openai(
        self,
        audio_data: bytes,
        content_type: str,
        language: str,
        prompt: Optional[str] = None,
    ) -> Tuple[str, float]:
        """Transcribe using OpenAI Whisper"""
        ext_map = {
            "audio/webm": "webm",
            "audio/mp3": "mp3",
            "audio/mpeg": "mp3",
            "audio/wav": "wav",
            "audio/m4a": "m4a",
            "audio/ogg": "ogg",
        }
        extension = ext_map.get(content_type, "webm")

        # Prepare multipart form data
        files = {
            "file": (f"audio.{extension}", audio_data, content_type),
            "model": (None, "whisper-1"),
            "language": (None, language),
            "response_format": (None, "verbose_json"),
        }

        if prompt:
            files["prompt"] = (None, prompt)

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers=self._get_openai_headers(),
                files=files,
            )
            response.raise_for_status()
            data = response.json()

        text = data.get("text", "")
        # Estimate confidence from segments
        segments = data.get("segments", [])
        if segments:
            avg_confidence = sum(
                seg.get("no_speech_prob", 0) for seg in segments
            ) / len(segments)
            confidence = 1.0 - avg_confidence
        else:
            confidence = 0.9 if text else 0.0

        return text, confidence

    async def transcribe_with_timestamps(
        self,
        audio_data: bytes,
        content_type: str = "audio/webm",
        language: str = "en",
    ) -> dict:
        """
        Transcribe audio with word-level timestamps (OpenAI only)

        Args:
            audio_data: Audio bytes
            content_type: MIME type
            language: Language code

        Returns:
            Dict with text and word timestamps
        """
        if not self.is_configured:
            raise ValueError("Whisper STT is not configured")

        if self.use_azure:
            # Azure doesn't support timestamps in the same way
            text, _ = await self._transcribe_azure(audio_data, content_type, language)
            return {"text": text}

        ext_map = {
            "audio/webm": "webm",
            "audio/mp3": "mp3",
            "audio/mpeg": "mp3",
            "audio/wav": "wav",
        }
        extension = ext_map.get(content_type, "webm")

        files = {
            "file": (f"audio.{extension}", audio_data, content_type),
            "model": (None, "whisper-1"),
            "language": (None, language),
            "response_format": (None, "verbose_json"),
            "timestamp_granularities[]": (None, "word"),
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers=self._get_openai_headers(),
                files=files,
            )
            response.raise_for_status()
            return response.json()


# Global service instance
whisper_service = WhisperService()
