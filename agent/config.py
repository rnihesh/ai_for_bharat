"""
Agent Service Configuration
Centralized configuration with environment variable loading
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional

# Load environment variables from .env file
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)


class AzureOpenAIConfig(BaseModel):
    """Azure OpenAI configuration"""
    api_key: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    endpoint: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    deployment_name: str = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")
    api_version: str = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.endpoint)


class MurfConfig(BaseModel):
    """Murf AI TTS configuration"""
    api_key: str = os.getenv("MURF_API_KEY", "")
    base_url: str = "https://api.murf.ai/v1"
    default_voice: str = "en-IN-isha"  # Indian English voice

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)


class WhisperConfig(BaseModel):
    """Whisper STT configuration - supports both Azure and OpenAI"""
    # Azure Whisper (preferred)
    azure_endpoint: str = os.getenv("AZURE_WHISPER_ENDPOINT", "")
    azure_api_key: str = os.getenv("AZURE_WHISPER_API_KEY", os.getenv("AZURE_OPENAI_API_KEY", ""))

    # OpenAI Whisper (fallback)
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")

    @property
    def is_configured(self) -> bool:
        return bool(self.azure_endpoint and self.azure_api_key) or bool(self.openai_api_key)

    @property
    def use_azure(self) -> bool:
        return bool(self.azure_endpoint and self.azure_api_key)


class WeatherConfig(BaseModel):
    """Google Weather API configuration"""
    api_key: str = os.getenv("GOOGLE_MAPS_API_KEY", "AIzaSyBP9bHQBv0j7VX3xBiHgcJFJ989TXLnoMk")
    base_url: str = "https://weather.googleapis.com/v1"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)


def _get_firebase_private_key() -> str:
    """Get and properly format the Firebase private key"""
    key = os.getenv("FIREBASE_PRIVATE_KEY", "")
    # Remove surrounding quotes if present
    if key.startswith('"') and key.endswith('"'):
        key = key[1:-1]
    if key.startswith("'") and key.endswith("'"):
        key = key[1:-1]
    # Replace literal \n with actual newlines
    key = key.replace("\\n", "\n")
    return key


class FirebaseConfig(BaseModel):
    """Firebase configuration"""
    project_id: str = os.getenv("FIREBASE_PROJECT_ID", "civiclemma")
    client_email: str = os.getenv("FIREBASE_CLIENT_EMAIL", "")
    private_key: str = _get_firebase_private_key()

    @property
    def is_configured(self) -> bool:
        return bool(self.project_id and self.client_email and self.private_key)


class ServiceURLs(BaseModel):
    """External service URLs"""
    main_server: str = os.getenv("MAIN_SERVER_URL", "http://localhost:3001")
    ml_service: str = os.getenv("ML_SERVICE_URL", "http://localhost:8000")


class TelegramConfig(BaseModel):
    """Telegram bot configuration"""
    bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")

    @property
    def is_configured(self) -> bool:
        return bool(self.bot_token)


class AgentConfig(BaseModel):
    """Main agent configuration"""
    azure_openai: AzureOpenAIConfig = AzureOpenAIConfig()
    murf: MurfConfig = MurfConfig()
    whisper: WhisperConfig = WhisperConfig()
    weather: WeatherConfig = WeatherConfig()
    firebase: FirebaseConfig = FirebaseConfig()
    services: ServiceURLs = ServiceURLs()
    telegram: TelegramConfig = TelegramConfig()

    # Agent settings
    max_conversation_turns: int = 20
    session_timeout_minutes: int = 30

    def print_status(self):
        """Print configuration status"""
        print("=" * 60)
        print("Agent Service Configuration Status")
        print("=" * 60)
        print(f"  Azure OpenAI: {'Configured' if self.azure_openai.is_configured else 'NOT CONFIGURED'}")
        print(f"  Murf AI TTS:  {'Configured' if self.murf.is_configured else 'NOT CONFIGURED'}")
        print(f"  Whisper STT:  {'Configured' if self.whisper.is_configured else 'Browser fallback'}")
        print(f"  Google Weather API: {'Configured' if self.weather.is_configured else 'NOT CONFIGURED'}")
        print(f"  Firebase:     {'Configured' if self.firebase.is_configured else 'NOT CONFIGURED'}")
        print(f"  Telegram Bot: {'Configured' if self.telegram.is_configured else 'NOT CONFIGURED'}")
        print("=" * 60)


# Global config instance
config = AgentConfig()
