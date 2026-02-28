"""
Amazon Polly Text-to-Speech Service
"""

import boto3
from typing import Optional
from config import config


class PollyService:
    """Amazon Polly TTS client"""

    def __init__(self):
        self._client = None

    @property
    def is_configured(self) -> bool:
        return config.polly.is_configured

    @property
    def client(self):
        if self._client is None:
            self._client = boto3.client(
                "polly",
                region_name=config.polly.region,
            )
        return self._client

    async def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        style: str = "conversational",
        speed: float = 1.0,
        pitch: float = 0.0,
    ) -> bytes:
        """
        Synthesize speech from text using Amazon Polly

        Args:
            text: Text to synthesize
            voice: Polly Voice ID (default: Kajal for Indian English)
            style: Engine type ('standard', 'neural', 'generative')
            speed: Speech speed (0.5-2.0)
            pitch: Pitch adjustment (unused in Polly, kept for API compat)

        Returns:
            Audio data as bytes (MP3 format)
        """
        if not self.is_configured:
            raise ValueError("Amazon Polly is not configured")

        voice = voice or config.polly.default_voice

        # Use SSML for speed control
        if speed != 1.0:
            rate_pct = int(speed * 100)
            ssml_text = f'<speak><prosody rate="{rate_pct}%">{text}</prosody></speak>'
            text_type = "ssml"
        else:
            ssml_text = text
            text_type = "text"

        # Determine engine based on voice
        engine = config.polly.engine

        response = self.client.synthesize_speech(
            Text=ssml_text,
            TextType=text_type,
            OutputFormat="mp3",
            VoiceId=voice,
            Engine=engine,
            SampleRate="24000",
        )

        # Read audio stream
        audio_stream = response.get("AudioStream")
        if not audio_stream:
            raise ValueError("No audio stream in response")

        return audio_stream.read()

    async def get_voices(self, language_code: str = "en-IN") -> list:
        """Get available voices for a language"""
        if not self.is_configured:
            raise ValueError("Amazon Polly is not configured")

        response = self.client.describe_voices(LanguageCode=language_code)
        return [
            {
                "id": v["Id"],
                "name": v["Name"],
                "gender": v["Gender"],
                "engine": v.get("SupportedEngines", []),
            }
            for v in response.get("Voices", [])
        ]

    def get_indian_voices(self) -> list:
        """Get recommended Indian voices"""
        return [
            {"id": "Kajal", "name": "Kajal", "gender": "Female", "accent": "Indian English", "engine": "neural"},
            {"id": "Aditi", "name": "Aditi", "gender": "Female", "accent": "Indian English/Hindi", "engine": "standard"},
        ]


# Global service instance
polly_service = PollyService()
