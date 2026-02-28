"""
Telegram Bot Integration for CivicLemma
Enables citizens to report civic issues through Telegram
"""

from telegram_bot.bot import init_telegram_bot, stop_telegram_bot

__all__ = ["init_telegram_bot", "stop_telegram_bot"]
