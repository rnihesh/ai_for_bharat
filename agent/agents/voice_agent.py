"""
Voice Agent for voice-based issue reporting
"""

from typing import Dict, Any, Optional
from models.conversation import ConversationSession, MessageRole
from agents.chat_agent import ChatAgent
from services.whisper import whisper_service
from services.murf import murf_service
from config import config


class VoiceAgent(ChatAgent):
    """
    Voice agent that extends ChatAgent with speech capabilities.

    Speech-to-Text Strategy:
    1. If OPENAI_API_KEY is configured: Use OpenAI Whisper API (server-side)
    2. Otherwise: Return flag for browser to use Web Speech API (client-side)

    Text-to-Speech:
    - Uses Murf AI for natural-sounding Indian English voices
    """

    def __init__(self, session: ConversationSession):
        super().__init__(session)
        self.whisper_available = config.whisper.is_configured
        self.tts_available = config.murf.is_configured

    async def process_audio(
        self,
        audio_data: bytes,
        content_type: str = "audio/webm",
    ) -> Dict[str, Any]:
        """
        Process voice audio input

        Args:
            audio_data: Audio bytes
            content_type: MIME type of audio

        Returns:
            Response with transcription and audio response
        """
        # Transcribe audio
        if self.whisper_available:
            transcription, confidence = await self._transcribe_server_side(
                audio_data, content_type
            )
        else:
            # Should not reach here - client should use browser STT
            return {
                "error": "Server-side transcription not available",
                "use_browser_stt": True,
                "transcription": None,
                "response_text": None,
            }

        if not transcription:
            return {
                "transcription": "",
                "response_text": "I could not understand that. Could you please repeat?",
                "confidence": confidence,
            }

        # Add user message to conversation
        self.session.add_message(
            role=MessageRole.USER,
            content=transcription,
        )

        # Process through chat agent logic
        result = await self.process_message(transcription)

        response_text = result["message"]

        # Generate audio response if TTS is available
        response_audio_url = None
        if self.tts_available:
            try:
                audio_response = await self._synthesize_response(response_text)
                # In production, you would upload this to cloud storage
                # and return the URL. For now, we'll handle it differently.
                response_audio_url = None  # Client will use the /voice/tts endpoint
            except Exception as e:
                print(f"TTS error: {e}")

        # Add assistant response
        self.session.add_message(
            role=MessageRole.ASSISTANT,
            content=response_text,
        )

        return {
            "transcription": transcription,
            "confidence": confidence,
            "response_text": response_text,
            "response_audio_url": response_audio_url,
            "state": self.session.state.value,
        }

    async def _transcribe_server_side(
        self,
        audio_data: bytes,
        content_type: str,
    ) -> tuple[str, float]:
        """
        Transcribe audio using OpenAI Whisper

        Args:
            audio_data: Audio bytes
            content_type: MIME type

        Returns:
            Tuple of (transcription, confidence)
        """
        try:
            # Provide context prompt for better recognition
            context_prompt = (
                "CivicLemma civic issue reporting. "
                "Pothole, garbage, illegal parking, damaged sign, fallen tree, "
                "vandalism, graffiti, dead animal, damaged concrete, electrical pole. "
                "Yes, no, submit, confirm, cancel."
            )

            transcription, confidence = await whisper_service.transcribe(
                audio_data=audio_data,
                content_type=content_type,
                language="en",
                prompt=context_prompt,
            )

            return transcription, confidence

        except Exception as e:
            print(f"Transcription error: {e}")
            return "", 0.0

    async def _synthesize_response(self, text: str) -> bytes:
        """
        Synthesize speech from text

        Args:
            text: Text to synthesize

        Returns:
            Audio bytes
        """
        return await murf_service.synthesize(
            text=text,
            voice=config.murf.default_voice,
            style="Conversational",
        )

    def get_voice_config(self) -> Dict[str, Any]:
        """
        Get voice configuration for client

        Returns:
            Dict with voice configuration
        """
        return {
            "whisper_enabled": self.whisper_available,
            "tts_enabled": self.tts_available,
            "use_browser_stt": not self.whisper_available,
            "voice_options": murf_service.get_indian_voices() if self.tts_available else [],
            "default_voice": config.murf.default_voice,
        }

    async def get_voice_greeting(self) -> Dict[str, Any]:
        """
        Get greeting with audio

        Returns:
            Dict with text and optional audio
        """
        text = await self.get_greeting()

        audio_data = None
        if self.tts_available:
            try:
                audio_data = await self._synthesize_response(text)
            except Exception as e:
                print(f"TTS error for greeting: {e}")

        return {
            "text": text,
            "has_audio": audio_data is not None,
        }
