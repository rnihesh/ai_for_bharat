"""
Conversation models for chat and voice agents
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import uuid


class MessageRole(str, Enum):
    """Role of message sender"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ConversationState(str, Enum):
    """Current state of the conversation flow"""
    GREETING = "greeting"
    COLLECTING_ISSUE = "collecting_issue"
    COLLECTING_IMAGE = "collecting_image"
    COLLECTING_LOCATION = "collecting_location"
    CONFIRMING = "confirming"
    SUBMITTING = "submitting"
    COMPLETED = "completed"
    ERROR = "error"


class ConversationMessage(BaseModel):
    """A single message in the conversation"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: MessageRole
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Optional fields for rich content
    image_url: Optional[str] = None
    audio_url: Optional[str] = None
    location: Optional[Dict[str, float]] = None


class ConversationSession(BaseModel):
    """A complete conversation session"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    state: ConversationState = ConversationState.GREETING
    messages: List[ConversationMessage] = Field(default_factory=list)

    # Collected data during conversation
    collected_data: Dict[str, Any] = Field(default_factory=dict)

    # Session metadata
    is_voice: bool = False
    user_agent: Optional[str] = None

    def add_message(
        self,
        role: MessageRole,
        content: str,
        image_url: Optional[str] = None,
        audio_url: Optional[str] = None,
        location: Optional[Dict[str, float]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ConversationMessage:
        """Add a message to the conversation"""
        message = ConversationMessage(
            role=role,
            content=content,
            image_url=image_url,
            audio_url=audio_url,
            location=location,
            metadata=metadata or {},
        )
        self.messages.append(message)
        self.updated_at = datetime.utcnow()
        return message

    def get_messages_for_llm(self) -> List[Dict[str, str]]:
        """Get messages formatted for LLM API"""
        return [
            {"role": msg.role.value, "content": msg.content}
            for msg in self.messages
        ]

    def update_state(self, new_state: ConversationState) -> None:
        """Update conversation state"""
        self.state = new_state
        self.updated_at = datetime.utcnow()

    def set_collected_data(self, key: str, value: Any) -> None:
        """Set collected data"""
        self.collected_data[key] = value
        self.updated_at = datetime.utcnow()

    def get_collected_data(self, key: str, default: Any = None) -> Any:
        """Get collected data"""
        return self.collected_data.get(key, default)

    def has_required_data(self) -> bool:
        """Check if all required data has been collected"""
        required_fields = ["description", "location"]
        has_image = bool(self.collected_data.get("image_urls"))
        has_required = all(
            self.collected_data.get(field) for field in required_fields
        )
        return has_required and has_image

    def get_missing_fields(self) -> List[str]:
        """Get list of missing required fields"""
        missing = []
        if not self.collected_data.get("description"):
            missing.append("description")
        if not self.collected_data.get("image_urls"):
            missing.append("image")
        if not self.collected_data.get("location"):
            missing.append("location")
        return missing
