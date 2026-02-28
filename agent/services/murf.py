"""
Murf AI Text-to-Speech Service
"""

import httpx
from typing import Optional
from config import config


class MurfService:
    """Murf AI TTS client"""

    def __init__(self):
        self.api_key = config.murf.api_key
        self.base_url = config.murf.base_url
        self.default_voice = config.murf.default_voice

    @property
    def is_configured(self) -> bool:
        return config.murf.is_configured

    def _get_headers(self) -> dict:
        """Get request headers"""
        return {
            "Content-Type": "application/json",
            "api-key": self.api_key,
        }

    async def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        style: str = "Conversational",
        speed: float = 1.0,
        pitch: float = 0.0,
    ) -> bytes:
        """
        Synthesize speech from text

        Args:
            text: Text to synthesize
            voice: Voice ID (default: en-IN-isha)
            style: Speaking style
            speed: Speech speed (0.5-2.0)
            pitch: Pitch adjustment (-12 to 12)

        Returns:
            Audio data as bytes (MP3 format)
        """
        if not self.is_configured:
            raise ValueError("Murf TTS is not configured")

        voice = voice or self.default_voice

        payload = {
            "voiceId": voice,
            "style": style,
            "text": text,
            "rate": int(speed * 100),  # Murf uses percentage
            "pitch": int(pitch),
            "sampleRate": 24000,
            "format": "MP3",
            "channelType": "MONO",
            "pronunciationDictionary": {},
            "encodeAsBase64": False,
            "variation": 1,
            "audioDuration": 0,
            "modelVersion": "GEN2",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/speech/generate",
                headers=self._get_headers(),
                json=payload,
            )
            response.raise_for_status()

            # Murf returns JSON with audioFile URL
            data = response.json()
            audio_url = data.get("audioFile")

            if not audio_url:
                raise ValueError("No audio file in response")

            # Download the audio file
            audio_response = await client.get(audio_url)
            audio_response.raise_for_status()
            return audio_response.content

    async def get_voices(self) -> list:
        """Get available voices"""
        if not self.is_configured:
            raise ValueError("Murf TTS is not configured")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/voices",
                headers=self._get_headers(),
            )
            response.raise_for_status()
            return response.json()

    def get_indian_voices(self) -> list:
        """Get recommended Indian English voices"""
        return [
            {"id": "en-IN-isha", "name": "Isha", "gender": "female", "accent": "Indian English"},
            {"id": "en-IN-arjun", "name": "Arjun", "gender": "male", "accent": "Indian English"},
            {"id": "en-IN-priya", "name": "Priya", "gender": "female", "accent": "Indian English"},
            {"id": "en-IN-raj", "name": "Raj", "gender": "male", "accent": "Indian English"},
        ]


# Global service instance
murf_service = MurfService()
