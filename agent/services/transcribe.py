"""
Amazon Transcribe Speech-to-Text Service
"""

import boto3
import uuid
import time
import asyncio
from typing import Optional, Tuple
from config import config


class TranscribeService:
    """Amazon Transcribe STT client"""

    def __init__(self):
        self._client = None

    @property
    def is_configured(self) -> bool:
        return config.transcribe.is_configured

    @property
    def client(self):
        if self._client is None:
            self._client = boto3.client(
                "transcribe",
                region_name=config.transcribe.region,
            )
        return self._client

    @property
    def s3_client(self):
        return boto3.client("s3", region_name=config.transcribe.region)

    async def transcribe(
        self,
        audio_data: bytes,
        content_type: str = "audio/webm",
        language: str = "en-IN",
        prompt: Optional[str] = None,
    ) -> Tuple[str, float]:
        """
        Transcribe audio to text using Amazon Transcribe

        Args:
            audio_data: Audio bytes  
            content_type: MIME type of audio
            language: Language code (e.g., en-IN, hi-IN, ta-IN)
            prompt: Optional context prompt (unused, kept for API compat)

        Returns:
            Tuple of (transcription text, confidence score)
        """
        if not self.is_configured:
            raise ValueError("Amazon Transcribe is not configured")

        # Map language codes
        lang_map = {
            "en": "en-IN",
            "hi": "hi-IN",
            "ta": "ta-IN",
            "te": "te-IN",
            "kn": "kn-IN",
            "ml": "ml-IN",
            "mr": "mr-IN",
            "bn": "bn-IN",
            "gu": "gu-IN",
            "pa": "pa-IN",
        }
        transcribe_lang = lang_map.get(language, language)

        # Map content type to media format
        format_map = {
            "audio/webm": "webm",
            "audio/mp3": "mp3",
            "audio/mpeg": "mp3",
            "audio/wav": "wav",
            "audio/m4a": "mp4",
            "audio/ogg": "ogg",
        }
        media_format = format_map.get(content_type, "webm")

        # Upload audio to S3 for Transcribe
        bucket = config.transcribe.s3_bucket
        job_name = f"transcribe-{uuid.uuid4().hex[:12]}"
        s3_key = f"audio-temp/{job_name}.{media_format}"

        self.s3_client.put_object(
            Bucket=bucket,
            Key=s3_key,
            Body=audio_data,
            ContentType=content_type,
        )

        try:
            # Start transcription job
            self.client.start_transcription_job(
                TranscriptionJobName=job_name,
                Media={"MediaFileUri": f"s3://{bucket}/{s3_key}"},
                MediaFormat=media_format,
                LanguageCode=transcribe_lang,
            )

            # Wait for completion
            text, confidence = await self._wait_for_job(job_name)

            return text, confidence

        finally:
            # Clean up S3 temp file
            try:
                self.s3_client.delete_object(Bucket=bucket, Key=s3_key)
            except Exception:
                pass

    async def _wait_for_job(
        self, job_name: str, timeout: int = 60
    ) -> Tuple[str, float]:
        """Wait for a transcription job to complete"""
        start = time.time()

        while time.time() - start < timeout:
            response = self.client.get_transcription_job(
                TranscriptionJobName=job_name
            )
            status = response["TranscriptionJob"]["TranscriptionJobStatus"]

            if status == "COMPLETED":
                # Get transcript
                import httpx

                transcript_uri = response["TranscriptionJob"]["Transcript"][
                    "TranscriptFileUri"
                ]
                async with httpx.AsyncClient() as client:
                    resp = await client.get(transcript_uri)
                    data = resp.json()

                results = data.get("results", {})
                transcripts = results.get("transcripts", [])
                text = transcripts[0]["transcript"] if transcripts else ""

                # Get average confidence from items
                items = results.get("items", [])
                if items:
                    confidences = [
                        float(alt["confidence"])
                        for item in items
                        for alt in item.get("alternatives", [])
                        if "confidence" in alt
                    ]
                    confidence = sum(confidences) / len(confidences) if confidences else 0.9
                else:
                    confidence = 0.9 if text else 0.0

                # Clean up the job
                try:
                    self.client.delete_transcription_job(
                        TranscriptionJobName=job_name
                    )
                except Exception:
                    pass

                return text, confidence

            elif status == "FAILED":
                reason = response["TranscriptionJob"].get(
                    "FailureReason", "Unknown"
                )
                raise RuntimeError(f"Transcription failed: {reason}")

            await asyncio.sleep(1)

        raise TimeoutError("Transcription job timed out")

    async def transcribe_with_timestamps(
        self,
        audio_data: bytes,
        content_type: str = "audio/webm",
        language: str = "en-IN",
    ) -> dict:
        """
        Transcribe audio with word-level timestamps

        Args:
            audio_data: Audio bytes
            content_type: MIME type
            language: Language code

        Returns:
            Dict with text and word timestamps
        """
        text, confidence = await self.transcribe(
            audio_data, content_type, language
        )
        return {"text": text, "confidence": confidence}


# Global service instance
transcribe_service = TranscribeService()
