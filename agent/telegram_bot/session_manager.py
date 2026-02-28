"""
Session manager for Telegram bot
Maps Telegram user_id to agent session_id and manages short-term memory
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, Optional

from models.conversation import ConversationSession
from telegram_bot.memory import ShortTermMemory


@dataclass
class TelegramSessionInfo:
    """Information about a Telegram user's session"""
    telegram_user_id: int
    agent_session: ConversationSession
    memory: ShortTermMemory = field(default_factory=ShortTermMemory)
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_activity: datetime = field(default_factory=datetime.utcnow)


class TelegramSessionManager:
    """
    Manages mapping between Telegram users and agent sessions.
    Each Telegram user gets their own agent session and short-term memory.
    """

    def __init__(self, session_timeout_minutes: int = 30):
        self._sessions: Dict[int, TelegramSessionInfo] = {}
        self._session_timeout_minutes = session_timeout_minutes

    def get_session(self, telegram_user_id: int) -> Optional[TelegramSessionInfo]:
        """
        Get existing session for a Telegram user.

        Args:
            telegram_user_id: Telegram user ID

        Returns:
            Session info or None if not found/expired
        """
        session_info = self._sessions.get(telegram_user_id)

        if session_info is None:
            return None

        # Check if session is expired
        if self._is_expired(session_info):
            self._sessions.pop(telegram_user_id, None)
            return None

        # Update last activity
        session_info.last_activity = datetime.utcnow()
        session_info.memory.touch()

        return session_info

    def get_or_create_session(self, telegram_user_id: int) -> TelegramSessionInfo:
        """
        Get existing session or create a new one.

        Args:
            telegram_user_id: Telegram user ID

        Returns:
            Session info (new or existing)
        """
        # Try to get existing session
        session_info = self.get_session(telegram_user_id)

        if session_info is not None:
            return session_info

        # Create new session
        agent_session = ConversationSession(
            is_voice=False,
            user_agent="Telegram Bot",
        )

        session_info = TelegramSessionInfo(
            telegram_user_id=telegram_user_id,
            agent_session=agent_session,
        )

        self._sessions[telegram_user_id] = session_info
        print(f"[TelegramSession] Created new session for user {telegram_user_id}: {agent_session.id}")

        return session_info

    def get_memory(self, telegram_user_id: int) -> ShortTermMemory:
        """
        Get short-term memory for a user.

        Args:
            telegram_user_id: Telegram user ID

        Returns:
            User's short-term memory
        """
        session_info = self.get_or_create_session(telegram_user_id)
        return session_info.memory

    def reset_session(self, telegram_user_id: int) -> TelegramSessionInfo:
        """
        Reset a user's session (creates a fresh session).

        Args:
            telegram_user_id: Telegram user ID

        Returns:
            New session info
        """
        # Remove existing session
        self._sessions.pop(telegram_user_id, None)

        # Create new session
        return self.get_or_create_session(telegram_user_id)

    def _is_expired(self, session_info: TelegramSessionInfo) -> bool:
        """Check if a session has expired"""
        expiry_time = session_info.last_activity + timedelta(minutes=self._session_timeout_minutes)
        return datetime.utcnow() > expiry_time

    def cleanup_expired_sessions(self) -> int:
        """
        Remove all expired sessions.

        Returns:
            Number of sessions removed
        """
        expired_users = [
            user_id for user_id, session_info in self._sessions.items()
            if self._is_expired(session_info)
        ]

        for user_id in expired_users:
            self._sessions.pop(user_id, None)

        if expired_users:
            print(f"[TelegramSession] Cleaned up {len(expired_users)} expired sessions")

        return len(expired_users)

    def get_active_session_count(self) -> int:
        """Get count of active (non-expired) sessions"""
        return sum(1 for info in self._sessions.values() if not self._is_expired(info))


# Global session manager instance
telegram_session_manager = TelegramSessionManager()
