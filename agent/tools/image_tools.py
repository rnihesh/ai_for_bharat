"""
Image analysis tools using AWS Bedrock Vision
"""

from typing import Dict, Any, Optional
from services.bedrock import bedrock_service


class ImageTools:
    """Tools for image analysis"""

    @staticmethod
    async def analyze_issue_image(image_url: str) -> Dict[str, Any]:
        """
        Analyze an issue image to extract information

        Args:
            image_url: URL of the image

        Returns:
            Dict with analysis results
        """
        prompt = """Analyze this image of a civic/municipal issue. Extract the following information:

1. Issue Type: What type of issue is shown? (pothole, garbage, illegal parking, damaged sign, fallen tree, vandalism/graffiti, dead animal, damaged concrete, damaged electrical, or other)
2. Description: Write a brief, factual description of what you see (2-3 sentences)
3. Severity Indicators: Note any visual indicators of severity (size, extent, danger)
4. Location Clues: Any visible landmarks, street signs, or location indicators

Respond in this exact JSON format:
{
    "detected_type": "<issue type>",
    "description": "<description>",
    "severity_indicators": ["<indicator1>", "<indicator2>"],
    "location_clues": ["<clue1>", "<clue2>"],
    "confidence": <0.0-1.0>
}"""

        response = await bedrock_service.analyze_image(image_url, prompt)

        # Parse JSON response
        import json
        try:
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            return json.loads(response.strip())
        except json.JSONDecodeError:
            return {
                "detected_type": "unknown",
                "description": response,
                "severity_indicators": [],
                "location_clues": [],
                "confidence": 0.5,
            }

    @staticmethod
    async def assess_severity(
        image_url: str,
        issue_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Assess the severity of an issue from image

        Args:
            image_url: URL of the image
            issue_type: Optional issue type for context

        Returns:
            Severity assessment
        """
        return await bedrock_service.analyze_image_severity(image_url, issue_type or "")

    @staticmethod
    async def validate_issue_image(image_url: str) -> Dict[str, Any]:
        """
        Validate that an image shows a legitimate civic issue

        Args:
            image_url: URL of the image

        Returns:
            Validation results
        """
        prompt = """Examine this image and determine if it shows a legitimate civic/municipal issue that should be reported.

Valid issues include: potholes, garbage/littering, illegal parking, damaged road signs, fallen trees, vandalism/graffiti, dead animals, damaged concrete structures, damaged electrical poles/wires.

Invalid submissions include: personal disputes, private property issues, unrelated images, inappropriate content, images that don't clearly show an issue.

Respond in this exact JSON format:
{
    "is_valid": true/false,
    "reason": "<explanation>",
    "suggestions": ["<suggestion if invalid>"]
}"""

        response = await bedrock_service.analyze_image(image_url, prompt)

        import json
        try:
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            return json.loads(response.strip())
        except json.JSONDecodeError:
            return {
                "is_valid": True,  # Default to accepting
                "reason": "Unable to validate image",
                "suggestions": [],
            }

    @staticmethod
    async def compare_images(
        before_url: str,
        after_url: str,
    ) -> Dict[str, Any]:
        """
        Compare before and after images to verify resolution

        Args:
            before_url: URL of the original issue image
            after_url: URL of the resolution image

        Returns:
            Comparison results
        """
        prompt = f"""Compare these two images. The first shows a reported civic issue, and the second should show the issue after resolution.

First image (issue): {before_url}
Second image (resolution): Analyze this image.

Determine:
1. Is this the same location?
2. Has the issue been resolved?
3. Quality of the resolution

Respond in this exact JSON format:
{{
    "same_location": true/false,
    "is_resolved": true/false,
    "resolution_quality": "<excellent/good/partial/poor/not_resolved>",
    "confidence": <0.0-1.0>,
    "notes": "<any additional observations>"
}}"""

        response = await bedrock_service.analyze_image(after_url, prompt)

        import json
        try:
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            return json.loads(response.strip())
        except json.JSONDecodeError:
            return {
                "same_location": False,
                "is_resolved": False,
                "resolution_quality": "unknown",
                "confidence": 0.0,
                "notes": response,
            }
