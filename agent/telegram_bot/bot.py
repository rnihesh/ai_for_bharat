"""
Telegram Bot initialization and lifecycle management
Starts and stops the bot with the agent service
"""

from typing import Optional
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters

from telegram_bot.handlers import (
    start_handler,
    help_handler,
    cancel_handler,
    photo_handler,
    callback_handler,
    location_handler,
    text_handler,
)


# Global application instance
_telegram_app: Optional[Application] = None


async def init_telegram_bot(token: str) -> bool:
    """
    Initialize and start the Telegram bot.

    Args:
        token: Telegram bot token

    Returns:
        True if started successfully, False otherwise
    """
    global _telegram_app

    if not token:
        print("[TelegramBot] No bot token provided, skipping initialization")
        return False

    try:
        print("[TelegramBot] Initializing...")

        # Build the application
        _telegram_app = Application.builder().token(token).build()

        # Add command handlers
        _telegram_app.add_handler(CommandHandler("start", start_handler))
        _telegram_app.add_handler(CommandHandler("help", help_handler))
        _telegram_app.add_handler(CommandHandler("cancel", cancel_handler))

        # Add message handlers (order matters - more specific first)
        _telegram_app.add_handler(MessageHandler(filters.PHOTO, photo_handler))
        _telegram_app.add_handler(MessageHandler(filters.LOCATION, location_handler))
        _telegram_app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_handler))

        # Add callback handler for inline buttons
        _telegram_app.add_handler(CallbackQueryHandler(callback_handler))

        # Initialize the application
        await _telegram_app.initialize()

        # Start the application (starts the update queue)
        await _telegram_app.start()

        # Start polling for updates
        await _telegram_app.updater.start_polling(
            drop_pending_updates=True,  # Don't process old messages
            allowed_updates=["message", "callback_query"],  # Only these update types
        )

        print("[TelegramBot] Started successfully - polling for updates")
        return True

    except Exception as e:
        print(f"[TelegramBot] Failed to start: {e}")
        _telegram_app = None
        return False


async def stop_telegram_bot() -> None:
    """Stop the Telegram bot gracefully."""
    global _telegram_app

    if _telegram_app is None:
        return

    try:
        print("[TelegramBot] Stopping...")

        # Stop polling
        if _telegram_app.updater and _telegram_app.updater.running:
            await _telegram_app.updater.stop()

        # Stop the application
        await _telegram_app.stop()

        # Shutdown the application
        await _telegram_app.shutdown()

        print("[TelegramBot] Stopped successfully")

    except Exception as e:
        print(f"[TelegramBot] Error during shutdown: {e}")

    finally:
        _telegram_app = None


def is_bot_running() -> bool:
    """Check if the bot is currently running."""
    return _telegram_app is not None and _telegram_app.updater and _telegram_app.updater.running
