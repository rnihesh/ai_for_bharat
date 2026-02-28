"""
Azure OpenAI Service
Provides GPT-4o integration for chat and vision capabilities
"""

import base64
import httpx
from typing import List, Dict, Any, Optional
from config import config


class AzureOpenAIService:
    """Azure OpenAI API client"""

    def __init__(self):
        self.api_key = config.azure_openai.api_key
        self.endpoint = config.azure_openai.endpoint
        self.deployment = config.azure_openai.deployment_name
        self.api_version = config.azure_openai.api_version

    @property
    def is_configured(self) -> bool:
        return config.azure_openai.is_configured

    def _get_url(self) -> str:
        """Get the API URL"""
        return f"{self.endpoint}openai/deployments/{self.deployment}/chat/completions?api-version={self.api_version}"

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers"""
        return {
            "Content-Type": "application/json",
            "api-key": self.api_key,
        }

    async def chat(
        self,
        messages: List[Dict[str, Any]],
        temperature: float = 0.7,
        max_tokens: int = 1024,
        system_prompt: Optional[str] = None,
    ) -> str:
        """
        Send a chat request to Azure OpenAI

        Args:
            messages: List of message dicts with 'role' and 'content'
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens in response
            system_prompt: Optional system prompt to prepend

        Returns:
            Assistant's response text
        """
        if not self.is_configured:
            raise ValueError("Azure OpenAI is not configured")

        # Prepare messages
        all_messages = []
        if system_prompt:
            all_messages.append({"role": "system", "content": system_prompt})
        all_messages.extend(messages)

        payload = {
            "messages": all_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self._get_url(),
                headers=self._get_headers(),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        return data["choices"][0]["message"]["content"]

    async def chat_with_vision(
        self,
        messages: List[Dict[str, Any]],
        image_url: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        system_prompt: Optional[str] = None,
    ) -> str:
        """
        Send a chat request with an image to Azure OpenAI

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
            raise ValueError("Azure OpenAI is not configured")

        # Build messages with image
        all_messages = []
        if system_prompt:
            all_messages.append({"role": "system", "content": system_prompt})

        # Convert text messages and add image to the last user message
        for i, msg in enumerate(messages):
            if msg["role"] == "user" and i == len(messages) - 1:
                # Add image to last user message
                all_messages.append({
                    "role": "user",
                    "content": [
                        {"type": "text", "text": msg["content"]},
                        {
                            "type": "image_url",
                            "image_url": {"url": image_url, "detail": "high"},
                        },
                    ],
                })
            else:
                all_messages.append(msg)

        payload = {
            "messages": all_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self._get_url(),
                headers=self._get_headers(),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        return data["choices"][0]["message"]["content"]

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
        import json
        try:
            # Extract JSON from response (handle markdown code blocks)
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
azure_openai_service = AzureOpenAIService()
