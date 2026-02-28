"""
Base Agent class with common functionality
"""

from typing import Dict, Any, List, Optional
from models.conversation import ConversationSession, ConversationState, MessageRole
from services.azure_openai import azure_openai_service


class BaseAgent:
    """Base class for all agents"""

    def __init__(self, session: Optional[ConversationSession] = None):
        self.session = session
        self.llm = azure_openai_service

    def get_system_prompt(self) -> str:
        """Get the system prompt for this agent - override in subclasses"""
        return """You are a helpful AI assistant for CivicLemma, a civic issue reporting platform in India.
You help citizens report infrastructure issues like potholes, garbage, illegal parking, and more.
Be helpful, concise, and professional. Use simple English that is easy to understand."""

    async def generate_response(
        self,
        user_message: str,
        additional_context: Optional[str] = None,
        image_url: Optional[str] = None,
    ) -> str:
        """
        Generate a response using the LLM

        Args:
            user_message: User's message
            additional_context: Optional context to add
            image_url: Optional image URL for vision analysis

        Returns:
            Generated response
        """
        messages = []

        # Add conversation history if available
        if self.session:
            messages = self.session.get_messages_for_llm()

        # Add current message
        if not any(m.get("content") == user_message for m in messages):
            messages.append({"role": "user", "content": user_message})

        # Build system prompt with additional context
        system_prompt = self.get_system_prompt()
        if additional_context:
            system_prompt += f"\n\nAdditional Context:\n{additional_context}"

        # Generate response
        if image_url:
            response = await self.llm.chat_with_vision(
                messages=messages,
                image_url=image_url,
                system_prompt=system_prompt,
            )
        else:
            response = await self.llm.chat(
                messages=messages,
                system_prompt=system_prompt,
            )

        return response

    def update_session_state(self, new_state: ConversationState) -> None:
        """Update the session state"""
        if self.session:
            self.session.update_state(new_state)

    def set_collected_data(self, key: str, value: Any) -> None:
        """Set collected data in session"""
        if self.session:
            self.session.set_collected_data(key, value)

    def get_collected_data(self, key: str, default: Any = None) -> Any:
        """Get collected data from session"""
        if self.session:
            return self.session.get_collected_data(key, default)
        return default

    def extract_intent(self, message: str) -> Dict[str, Any]:
        """
        Simple intent extraction from message

        Args:
            message: User message

        Returns:
            Dict with extracted intent and entities
        """
        message_lower = message.lower()

        # Detect submission confirmation
        if any(word in message_lower for word in ["yes", "submit", "confirm", "correct", "ok", "okay", "proceed"]):
            return {"intent": "confirm", "value": True}

        if any(word in message_lower for word in ["no", "cancel", "wrong", "incorrect", "change"]):
            return {"intent": "deny", "value": False}

        # Detect help request
        if any(word in message_lower for word in ["help", "how", "what", "?"]):
            return {"intent": "help"}

        # Detect greeting
        if any(word in message_lower for word in ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"]):
            return {"intent": "greeting"}

        # Default to general message
        return {"intent": "message", "content": message}
