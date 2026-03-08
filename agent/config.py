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


class BedrockConfig(BaseModel):
    """AWS Bedrock configuration"""
    region: str = os.getenv("AWS_REGION", "ap-south-1")
    model_id: str = os.getenv("BEDROCK_MODEL_ID", "apac.amazon.nova-pro-v1:0")

    @property
    def is_configured(self) -> bool:
        return bool(self.region)


class PollyConfig(BaseModel):
    """Amazon Polly TTS configuration"""
    region: str = os.getenv("AWS_REGION", "ap-south-1")
    default_voice: str = os.getenv("POLLY_VOICE_ID", "Kajal")
    engine: str = os.getenv("POLLY_ENGINE", "neural")

    @property
    def is_configured(self) -> bool:
        return bool(self.region)


class TranscribeConfig(BaseModel):
    """Amazon Transcribe STT configuration"""
    region: str = os.getenv("AWS_REGION", "ap-south-1")
    s3_bucket: str = os.getenv("S3_BUCKET_NAME", "civiclemma-uploads")

    @property
    def is_configured(self) -> bool:
        return bool(self.region and self.s3_bucket)


class WeatherConfig(BaseModel):
    """Google Weather API configuration"""
    api_key: str = os.getenv("GOOGLE_MAPS_API_KEY", "")
    base_url: str = "https://weather.googleapis.com/v1"

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)


class DynamoDBConfig(BaseModel):
    """DynamoDB configuration"""
    region: str = os.getenv("AWS_REGION", "ap-south-1")
    table_prefix: str = os.getenv("DYNAMODB_TABLE_PREFIX", "civiclemma_")

    @property
    def is_configured(self) -> bool:
        return bool(self.region)


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
    bedrock: BedrockConfig = BedrockConfig()
    polly: PollyConfig = PollyConfig()
    transcribe: TranscribeConfig = TranscribeConfig()
    weather: WeatherConfig = WeatherConfig()
    dynamodb: DynamoDBConfig = DynamoDBConfig()
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
        print(f"  AWS Bedrock:  {'Configured' if self.bedrock.is_configured else 'NOT CONFIGURED'} (model: {self.bedrock.model_id})")
        print(f"  Amazon Polly: {'Configured' if self.polly.is_configured else 'NOT CONFIGURED'} (voice: {self.polly.default_voice})")
        print(f"  Transcribe:   {'Configured' if self.transcribe.is_configured else 'NOT CONFIGURED'}")
        print(f"  Google Weather API: {'Configured' if self.weather.is_configured else 'NOT CONFIGURED'}")
        print(f"  DynamoDB:     {'Configured' if self.dynamodb.is_configured else 'NOT CONFIGURED'}")
        print(f"  Telegram Bot: {'Configured' if self.telegram.is_configured else 'NOT CONFIGURED'}")
        print("=" * 60)


# Global config instance
config = AgentConfig()
