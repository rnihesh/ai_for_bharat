"""
AWS Bedrock LLM Service
Provides configurable model integration for chat and vision capabilities
"""

import json
import base64
import os
import httpx
import boto3
from typing import List, Dict, Any, Optional
from config import config


class BedrockService:
    """Amazon Bedrock API client"""

    # Trusted domains for image fetching (SSRF protection)
    ALLOWED_IMAGE_HOSTS = (
        ".s3.amazonaws.com",
        ".s3.ap-south-1.amazonaws.com",
        ".cloudfront.net",
    )

    def __init__(self):
        self._client = None

    @staticmethod
    def _validate_image_url(image_url: str) -> None:
        """Validate that image URL points to a trusted domain to prevent SSRF."""
        from urllib.parse import urlparse
        parsed = urlparse(image_url)
        if parsed.scheme != "https":
            raise ValueError("Only HTTPS image URLs are accepted.")
        host = (parsed.hostname or "").lower()
        cloudfront_domain = os.environ.get("CLOUDFRONT_DOMAIN", "").lower()
        if cloudfront_domain and host == cloudfront_domain:
            return
        if any(host.endswith(allowed) for allowed in BedrockService.ALLOWED_IMAGE_HOSTS):
            return
        raise ValueError(f"Image URL host not allowed: {host}")

    @property
    def is_configured(self) -> bool:
        return config.bedrock.is_configured

    @property
    def client(self):
        if self._client is None:
            self._client = boto3.client(
                "bedrock-runtime",
                region_name=config.bedrock.region,
            )
        return self._client

    async def chat(
        self,
        messages: List[Dict[str, Any]],
        temperature: float = 0.7,
        max_tokens: int = 1024,
        system_prompt: Optional[str] = None,
    ) -> str:
        """
        Send a chat request to Bedrock

        Args:
            messages: List of message dicts with 'role' and 'content'
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens in response
            system_prompt: Optional system prompt

        Returns:
            Assistant's response text
        """
        if not self.is_configured:
            raise ValueError("Bedrock is not configured")

        model_id = config.bedrock.model_id

        # Build Bedrock Converse API messages
        bedrock_messages = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]

            if role == "system":
                continue  # Handled separately

            if isinstance(content, str):
                bedrock_messages.append({
                    "role": role,
                    "content": [{"text": content}]
                })
            elif isinstance(content, list):
                # Already structured content (e.g., with images)
                bedrock_messages.append({
                    "role": role,
                    "content": content
                })

        # Bedrock converse API requires first message to be 'user' role
        while bedrock_messages and bedrock_messages[0]["role"] != "user":
            bedrock_messages.pop(0)

        if not bedrock_messages:
            return "I'm sorry, I couldn't process that. Could you please try again?"

        # Bedrock requires alternating user/assistant roles - merge consecutive same-role messages
        merged = []
        for msg in bedrock_messages:
            if merged and merged[-1]["role"] == msg["role"]:
                # Merge text content into previous message
                merged[-1]["content"].extend(msg["content"])
            else:
                merged.append(msg)
        bedrock_messages = merged

        # Build request
        request = {
            "modelId": model_id,
            "messages": bedrock_messages,
            "inferenceConfig": {
                "temperature": temperature,
                "maxTokens": max_tokens,
            },
        }

        # Add system prompt
        sys_prompts = []
        if system_prompt:
            sys_prompts.append({"text": system_prompt})
        # Also include any system messages from input
        for msg in messages:
            if msg["role"] == "system":
                sys_prompts.append({"text": msg["content"]})
        if sys_prompts:
            request["system"] = sys_prompts

        response = self.client.converse(**request)
        output = response["output"]["message"]["content"]
        return output[0]["text"] if output else ""

    async def chat_with_vision(
        self,
        messages: List[Dict[str, Any]],
        image_url: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        system_prompt: Optional[str] = None,
    ) -> str:
        """
        Send a chat request with an image to Bedrock

        Args:
            messages: List of message dicts
            image_url: URL of the image to analyze
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response
            system_prompt: Optional system prompt

        Returns:
            Assistant's response text
        """
        if not self.is_configured:
            raise ValueError("Bedrock is not configured")

        # Download image and convert to base64
        self._validate_image_url(image_url)
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            img_response = await http_client.get(image_url)
            img_response.raise_for_status()
            image_bytes = img_response.content

        # Detect image format
        content_type = img_response.headers.get("content-type", "image/jpeg")
        format_map = {
            "image/jpeg": "jpeg",
            "image/jpg": "jpeg",
            "image/png": "png",
            "image/gif": "gif",
            "image/webp": "webp",
        }
        img_format = format_map.get(content_type, "jpeg")

        # Build messages with image
        bedrock_messages = []
        for i, msg in enumerate(messages):
            role = msg["role"]
            if role == "system":
                continue

            if role == "user" and i == len(messages) - 1:
                # Add image to last user message
                bedrock_messages.append({
                    "role": "user",
                    "content": [
                        {"text": msg["content"]},
                        {
                            "image": {
                                "format": img_format,
                                "source": {
                                    "bytes": image_bytes,
                                },
                            },
                        },
                    ],
                })
            else:
                bedrock_messages.append({
                    "role": role,
                    "content": [{"text": msg["content"]}]
                })

        request = {
            "modelId": config.bedrock.model_id,
            "messages": bedrock_messages,
            "inferenceConfig": {
                "temperature": temperature,
                "maxTokens": max_tokens,
            },
        }

        if system_prompt:
            request["system"] = [{"text": system_prompt}]

        response = self.client.converse(**request)
        output = response["output"]["message"]["content"]
        return output[0]["text"] if output else ""

    async def analyze_image(
        self,
        image_url: str,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> str:
        """
        Analyze an image with a specific prompt

        Args:
            image_url: URL of the image
            prompt: Analysis prompt
            temperature: Sampling temperature
            max_tokens: Maximum tokens

        Returns:
            Analysis result
        """
        messages = [{"role": "user", "content": prompt}]
        return await self.chat_with_vision(
            messages=messages,
            image_url=image_url,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    async def analyze_image_severity(self, image_url: str, issue_type: str = "") -> Dict[str, Any]:
        """
        Analyze image for severity scoring

        Args:
            image_url: URL of the issue image
            issue_type: Type of issue (if known)

        Returns:
            Dict with severity score (1-10) and reasoning
        """
        issue_context = f"The issue type is: {issue_type}. " if issue_type else ""

        prompt = f"""Analyze this image of a civic/municipal issue. {issue_context}

Evaluate the severity of the issue on a scale of 1-10, considering:
- Safety hazard level (danger to pedestrians, vehicles, or property)
- Size and extent of the damage/issue
- Urgency of repair needed
- Impact on daily life and accessibility

Respond in this exact JSON format:
{{
    "severity_score": <number 1-10>,
    "safety_hazard": "<none/low/medium/high/critical>",
    "size": "<small/medium/large/extensive>",
    "urgency": "<low/medium/high/immediate>",
    "reasoning": "<brief explanation of the assessment>"
}}"""

        response = await self.analyze_image(image_url, prompt, temperature=0.2)

        # Parse JSON response
        try:
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            return json.loads(response.strip())
        except json.JSONDecodeError:
            return {
                "severity_score": 5,
                "safety_hazard": "medium",
                "size": "medium",
                "urgency": "medium",
                "reasoning": response,
            }


# Global service instance
bedrock_service = BedrockService()
