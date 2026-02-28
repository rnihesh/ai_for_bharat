"""
Telegram bot message handlers
Handles all user interactions: commands, photos, locations, and text messages
"""

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup
from telegram.ext import ContextTypes

from agents.chat_agent import ChatAgent
from models.conversation import ConversationState, MessageRole
from models.issue import LocationData
from tools.location_tools import LocationTools
from tools.issue_tools import IssueTools

from telegram_bot.session_manager import telegram_session_manager, TelegramSessionInfo
from telegram_bot.memory import ImageAnalysis, ShortTermMemory
from telegram_bot.s3_upload import upload_telegram_photo
from telegram_bot.messages import get_message, detect_language, get_issue_type_label

from services.azure_openai import azure_openai_service
from config import config


# Callback data constants
CALLBACK_REPORT_YES = "report_yes"
CALLBACK_REPORT_NO = "report_no"


async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command - create new session and send welcome message"""
    user = update.effective_user
    if not user or not update.message:
        return

    print(f"[TelegramBot] /start from user {user.id} ({user.first_name})")

    # Create/reset session
    session_info = telegram_session_manager.reset_session(user.id)

    # Detect language from user's Telegram language setting
    lang = "en"
    if user.language_code:
        # Map Telegram language codes to our codes
        lang_map = {
            "hi": "hi", "ta": "ta", "te": "te", "kn": "kn",
            "ml": "ml", "mr": "mr", "bn": "bn", "gu": "gu", "pa": "pa",
        }
        lang = lang_map.get(user.language_code, "en")

    session_info.memory.detected_language = lang

    # Send welcome message
    welcome = get_message("welcome", lang)
    await update.message.reply_text(welcome, parse_mode="Markdown")


async def help_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command"""
    user = update.effective_user
    if not user or not update.message:
        return

    # Get user's language preference
    session_info = telegram_session_manager.get_session(user.id)
    lang = session_info.memory.detected_language if session_info else "en"

    help_text = get_message("help", lang)
    await update.message.reply_text(help_text, parse_mode="Markdown")


async def cancel_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /cancel command - reset current report"""
    user = update.effective_user
    if not user or not update.message:
        return

    # Get user's language preference
    session_info = telegram_session_manager.get_session(user.id)
    lang = session_info.memory.detected_language if session_info else "en"

    # Clear memory
    if session_info:
        session_info.memory.clear_all()

    await update.message.reply_text(get_message("cancelled", lang))


async def photo_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle photo uploads - analyze and offer to report"""
    user = update.effective_user
    message = update.message

    if not user or not message or not message.photo:
        return

    print(f"[TelegramBot] Photo received from user {user.id}")

    # Get/create session
    session_info = telegram_session_manager.get_or_create_session(user.id)
    memory = session_info.memory
    lang = memory.detected_language

    # Send "analyzing" message
    status_msg = await message.reply_text(get_message("analyzing", lang))

    try:
        # Get the largest photo (last in the list)
        photo = message.photo[-1]
        file_id = photo.file_id

        # Upload photo to Cloudinary
        image_url = await upload_telegram_photo(context.bot, file_id)

        if not image_url:
            await status_msg.edit_text(get_message("generic_error", lang))
            return

        print(f"[TelegramBot] Photo uploaded: {image_url}")

        # Classify the image using Azure OpenAI
        classification = await _classify_image(image_url)

        print(f"[TelegramBot] Classification result: {classification}")

        # Store analysis in memory
        analysis = ImageAnalysis(
            image_url=image_url,
            classification=classification,
            description=classification.get("description"),
            issue_type=classification.get("issueType"),
            confidence=classification.get("confidence", 0.0),
        )
        memory.store_analysis(analysis)

        # Check if it's a valid civic issue
        if analysis.is_civic_issue():
            # Format response with issue type and confidence
            issue_type = analysis.issue_type or "OTHER"
            issue_label = get_issue_type_label(issue_type, lang)
            confidence_pct = int(analysis.confidence * 100)
            description = analysis.description or "Civic infrastructure issue detected."

            response = get_message(
                "detected_issue",
                lang,
                issue_type=issue_label,
                confidence=confidence_pct,
                description=description,
            )

            # Create Yes/No inline keyboard
            keyboard = [
                [
                    InlineKeyboardButton(get_message("confirm_yes", lang), callback_data=CALLBACK_REPORT_YES),
                    InlineKeyboardButton(get_message("confirm_no", lang), callback_data=CALLBACK_REPORT_NO),
                ]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)

            await status_msg.edit_text(response, reply_markup=reply_markup, parse_mode="Markdown")
        else:
            # Not a civic issue
            await status_msg.edit_text(get_message("no_issue_detected", lang))

    except Exception as e:
        print(f"[TelegramBot] Error processing photo: {e}")
        await status_msg.edit_text(get_message("generic_error", lang))


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle inline keyboard callbacks (Yes/No buttons)"""
    query = update.callback_query
    if not query or not query.from_user:
        return

    user = query.from_user
    await query.answer()  # Acknowledge the callback

    print(f"[TelegramBot] Callback {query.data} from user {user.id}")

    # Get session
    session_info = telegram_session_manager.get_session(user.id)
    if not session_info:
        await query.edit_message_text(get_message("session_expired", "en"))
        return

    memory = session_info.memory
    lang = memory.detected_language

    if query.data == CALLBACK_REPORT_YES:
        # User wants to report the issue
        confirmed_analysis = memory.confirm_pending()

        if not confirmed_analysis:
            await query.edit_message_text(get_message("session_expired", lang))
            return

        # Check if we already have location
        if memory.has_location():
            # We have everything - submit!
            await query.edit_message_text(get_message("submitting", lang))
            await _submit_issue(session_info, query.message)
        else:
            # Need location
            issue_label = get_issue_type_label(confirmed_analysis.issue_type or "OTHER", lang)

            # Update message to confirm and request location
            response = f"Reporting: **{issue_label}**\n\n" + get_message("share_location", lang)

            # Create location request keyboard
            keyboard = [
                [KeyboardButton("Share Location", request_location=True)]
            ]
            reply_markup = ReplyKeyboardMarkup(keyboard, one_time_keyboard=True, resize_keyboard=True)

            # Edit the inline message
            await query.edit_message_text(response, parse_mode="Markdown")

            # Send a new message with the reply keyboard (can't combine inline and reply keyboards)
            await context.bot.send_message(
                chat_id=user.id,
                text=get_message("share_location", lang),
                reply_markup=reply_markup,
            )

    elif query.data == CALLBACK_REPORT_NO:
        # User doesn't want to report
        memory.clear_pending()
        await query.edit_message_text(get_message("cancelled", lang))


async def location_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle location sharing"""
    user = update.effective_user
    message = update.message

    if not user or not message or not message.location:
        return

    location = message.location
    print(f"[TelegramBot] Location received from user {user.id}: {location.latitude}, {location.longitude}")

    # Get session
    session_info = telegram_session_manager.get_session(user.id)
    if not session_info:
        await message.reply_text(get_message("session_expired", "en"))
        return

    memory = session_info.memory
    lang = memory.detected_language

    # Reverse geocode to get address
    try:
        address_info = await LocationTools.reverse_geocode(location.latitude, location.longitude)
        address = address_info.get("formatted_address", f"{location.latitude:.6f}, {location.longitude:.6f}")
    except Exception as e:
        print(f"[TelegramBot] Geocoding error: {e}")
        address = f"{location.latitude:.6f}, {location.longitude:.6f}"

    # Store location in memory
    memory.store_location(location.latitude, location.longitude, address)

    # Acknowledge location
    await message.reply_text(
        get_message("location_received", lang, address=address),
        reply_markup={"remove_keyboard": True},
    )

    # Check if we have a confirmed analysis ready to submit
    if memory.has_confirmed_analysis():
        status_msg = await message.reply_text(get_message("submitting", lang))
        await _submit_issue(session_info, status_msg)


async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle text messages - process through chat agent"""
    user = update.effective_user
    message = update.message

    if not user or not message or not message.text:
        return

    text = message.text
    print(f"[TelegramBot] Text from user {user.id}: {text[:50]}...")

    # Get/create session
    session_info = telegram_session_manager.get_or_create_session(user.id)
    memory = session_info.memory

    # Detect language from message
    detected_lang = detect_language(text)
    if detected_lang != "en":
        memory.detected_language = detected_lang

    lang = memory.detected_language

    # Check for confirmation keywords
    text_lower = text.lower()
    confirm_words = ["yes", "ok", "sure", "confirm", "report", "submit", "हां", "हाँ", "ठीक"]
    deny_words = ["no", "cancel", "stop", "नहीं", "रद्द"]

    if memory.has_pending_analysis() and any(word in text_lower for word in confirm_words):
        # User is confirming with text
        confirmed_analysis = memory.confirm_pending()
        if confirmed_analysis:
            if memory.has_location():
                status_msg = await message.reply_text(get_message("submitting", lang))
                await _submit_issue(session_info, status_msg)
            else:
                keyboard = [
                    [KeyboardButton("Share Location", request_location=True)]
                ]
                reply_markup = ReplyKeyboardMarkup(keyboard, one_time_keyboard=True, resize_keyboard=True)
                await message.reply_text(get_message("share_location", lang), reply_markup=reply_markup)
            return

    if memory.has_pending_analysis() and any(word in text_lower for word in deny_words):
        # User is declining
        memory.clear_pending()
        await message.reply_text(get_message("cancelled", lang))
        return

    # Process through ChatAgent for general conversation
    session = session_info.agent_session
    agent = ChatAgent(session)

    # Add user message to session
    session.add_message(MessageRole.USER, text)

    # Send "processing" indicator
    await context.bot.send_chat_action(chat_id=user.id, action="typing")

    try:
        response = await agent.process_message(message=text)
        response_text = response.get("message", get_message("generic_error", lang))

        # Add assistant response to session
        session.add_message(MessageRole.ASSISTANT, response_text)

        await message.reply_text(response_text, parse_mode="Markdown")

    except Exception as e:
        print(f"[TelegramBot] Error processing text: {e}")
        await message.reply_text(get_message("generic_error", lang))


async def _classify_image(image_url: str) -> dict:
    """
    Classify an image using Azure OpenAI.

    Args:
        image_url: URL of the image to classify

    Returns:
        Classification result dict
    """
    if not config.azure_openai.is_configured:
        return {
            "success": False,
            "isValid": False,
            "isUnrelated": True,
            "message": "Classification service not configured",
        }

    try:
        classification_prompt = """Analyze this image and determine if it shows a civic/municipal infrastructure issue.

If it IS a civic issue, identify the type from this list:
- Pothole/Road Damage
- Garbage/Littering
- Illegal Parking
- Street Light Issue
- Water Leakage
- Fallen Tree
- Graffiti/Vandalism
- Damaged Sign
- Dead Animal
- Damaged Concrete/Sidewalk
- Damaged Electrical (wires, poles)
- Other civic issue

Respond in this exact JSON format:
{
    "is_civic_issue": true/false,
    "issue_type": "detected type or null",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation",
    "description": "A brief 1-2 sentence description of what you see in the image suitable for an issue report"
}

Be strict - only mark as civic issue if it clearly shows infrastructure problems that municipalities handle."""

        result = await azure_openai_service.analyze_image(
            image_url=image_url,
            prompt=classification_prompt,
        )

        # Parse the JSON response
        import json
        try:
            response_text = result.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]

            data = json.loads(response_text)
        except json.JSONDecodeError:
            data = {
                "is_civic_issue": False,
                "issue_type": None,
                "confidence": 0.5,
                "reasoning": result,
                "description": result[:200] if len(result) > 200 else result,
            }

        is_civic = data.get("is_civic_issue", False)
        issue_type_raw = (data.get("issue_type", "") or "").lower()
        confidence = data.get("confidence", 0.7)
        description = data.get("description", "")

        # Map to app issue type
        issue_type_mapping = {
            "pothole": "POTHOLE", "road damage": "POTHOLE", "potholes": "POTHOLE",
            "garbage": "GARBAGE", "trash": "GARBAGE", "litter": "GARBAGE", "littering": "GARBAGE",
            "parking": "ILLEGAL_PARKING", "illegal parking": "ILLEGAL_PARKING",
            "street light": "DAMAGED_ELECTRICAL", "streetlight": "DAMAGED_ELECTRICAL",
            "water leak": "WATER_LEAKAGE", "water leakage": "WATER_LEAKAGE",
            "tree": "FALLEN_TREE", "fallen tree": "FALLEN_TREE",
            "graffiti": "VANDALISM", "vandalism": "VANDALISM",
            "sign": "DAMAGED_SIGN", "damaged sign": "DAMAGED_SIGN",
            "dead animal": "DEAD_ANIMAL",
            "concrete": "DAMAGED_CONCRETE", "sidewalk": "DAMAGED_CONCRETE",
            "electric": "DAMAGED_ELECTRICAL", "wire": "DAMAGED_ELECTRICAL",
        }

        mapped_issue_type = None
        for key, value in issue_type_mapping.items():
            if key in issue_type_raw:
                mapped_issue_type = value
                break

        if is_civic and not mapped_issue_type:
            mapped_issue_type = "OTHER"

        return {
            "success": True,
            "isValid": is_civic,
            "isUnrelated": not is_civic,
            "issueType": mapped_issue_type,
            "className": data.get("issue_type"),
            "confidence": confidence,
            "message": data.get("reasoning", "Image analyzed successfully"),
            "description": description,
        }

    except Exception as e:
        print(f"[TelegramBot] Classification error: {e}")
        return {
            "success": False,
            "isValid": False,
            "isUnrelated": True,
            "message": f"Classification failed: {str(e)}",
        }


async def _submit_issue(session_info: TelegramSessionInfo, message) -> None:
    """
    Submit the issue using collected data.

    Args:
        session_info: User's session info
        message: Telegram message to update with result
    """
    memory = session_info.memory
    lang = memory.detected_language

    if not memory.is_ready_for_submission():
        await message.edit_text(get_message("generic_error", lang))
        return

    analysis = memory.pending_analysis
    location = memory.pending_location

    if not analysis or not location:
        await message.edit_text(get_message("generic_error", lang))
        return

    try:
        # Create location data with geocoding
        try:
            address_info = await LocationTools.reverse_geocode(location["lat"], location["lng"])
            location_data = LocationData(
                latitude=location["lat"],
                longitude=location["lng"],
                address=address_info.get("formatted_address"),
                city=address_info.get("city"),
                state=address_info.get("state"),
                district=address_info.get("district"),
                pincode=address_info.get("pincode"),
                geohash=LocationTools.encode_geohash(location["lat"], location["lng"]),
            )
        except Exception as e:
            print(f"[TelegramBot] Geocoding error: {e}")
            location_data = LocationData(
                latitude=location["lat"],
                longitude=location["lng"],
                geohash=LocationTools.encode_geohash(location["lat"], location["lng"]),
            )

        # Prepare issue data
        from models.issue import CollectedIssueData, IssueType

        # Get issue type enum
        issue_type_str = analysis.issue_type or "OTHER"
        try:
            issue_type = IssueType(issue_type_str)
        except ValueError:
            issue_type = None

        # Use description from analysis or generate one
        description = analysis.description or f"Civic issue reported via Telegram: {issue_type_str}"

        issue_data = CollectedIssueData(
            description=description,
            issue_type=issue_type,
            image_urls=[analysis.image_url],
            location=location_data,
        )

        # Submit issue
        result = await IssueTools.submit_issue(issue_data)

        if result.get("success"):
            issue_id = result.get("issue_id", "Unknown")

            # Score priority in background
            try:
                from agents.priority_agent import PriorityAgent
                priority_agent = PriorityAgent()
                await priority_agent.score_issue(
                    issue_id=issue_id,
                    image_url=analysis.image_url,
                    description=description,
                    location={"lat": location["lat"], "lng": location["lng"]},
                    issue_type=issue_type_str,
                )
            except Exception as pe:
                print(f"[TelegramBot] Priority scoring failed (non-blocking): {pe}")

            # Get issue type label
            issue_label = get_issue_type_label(issue_type_str, lang)
            address = location_data.address or f"{location['lat']:.6f}, {location['lng']:.6f}"

            # Send success message
            success_msg = get_message(
                "submitted",
                lang,
                issue_type=issue_label,
                address=address,
                issue_id=issue_id,
            )

            await message.edit_text(success_msg, parse_mode="Markdown")

            # Clear memory after successful submission
            memory.clear_all()

        else:
            error = result.get("error", "Unknown error")
            await message.edit_text(get_message("submit_error", lang, error=error))

    except Exception as e:
        print(f"[TelegramBot] Submit error: {e}")
        await message.edit_text(get_message("submit_error", lang, error=str(e)))
