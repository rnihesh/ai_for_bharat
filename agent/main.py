"""
Agent Service - FastAPI Application
Provides AI-powered chat, voice, and priority scoring for civic issue reporting
"""

import os
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import uvicorn

from config import config
from models.conversation import ConversationSession, ConversationState, MessageRole
from models.priority import PriorityScore, BatchPriorityRequest, BatchPriorityResponse
from models.issue import CollectedIssueData, LocationData


# Session storage (in production, use Redis or similar)
sessions: Dict[str, ConversationSession] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("=" * 60)
    print("CivicLemma Agent Service")
    print("=" * 60)
    config.print_status()

    # Initialize services
    from services.bedrock import bedrock_service
    from services.dynamodb import dynamodb_service

    if config.bedrock.is_configured:
        print("Bedrock client initialized")

    if config.dynamodb.is_configured:
        dynamodb_service.initialize()
        print("DynamoDB initialized")

    # Initialize Telegram bot if configured
    telegram_started = False
    if config.telegram.is_configured:
        try:
            from telegram_bot.bot import init_telegram_bot
            telegram_started = await init_telegram_bot(config.telegram.bot_token)
            if telegram_started:
                print("Telegram bot initialized and polling")
        except Exception as e:
            print(f"Failed to start Telegram bot: {e}")

    print("=" * 60)
    print("Agent Service ready on port 8001")
    print("=" * 60)

    yield

    # Shutdown
    print("Agent Service shutting down...")

    # Stop Telegram bot
    if telegram_started:
        try:
            from telegram_bot.bot import stop_telegram_bot
            await stop_telegram_bot()
        except Exception as e:
            print(f"Error stopping Telegram bot: {e}")


# FastAPI app
app = FastAPI(
    title="CivicLemma Agent Service",
    description="AI-powered agents for civic issue reporting",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# Request/Response Models
# ============================================

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    services: Dict[str, bool]


class ConfigResponse(BaseModel):
    whisper_enabled: bool
    tts_enabled: bool
    weather_enabled: bool


class StartSessionRequest(BaseModel):
    is_voice: bool = False
    user_agent: Optional[str] = None


class StartSessionResponse(BaseModel):
    session_id: str
    message: str
    state: str


class ChatMessageRequest(BaseModel):
    session_id: str
    message: str
    image_url: Optional[str] = None
    location: Optional[Dict[str, float]] = None


class ChatMessageResponse(BaseModel):
    session_id: str
    message: str
    state: str
    collected_data: Dict[str, Any]
    is_complete: bool
    missing_fields: List[str]
    issue_id: Optional[str] = None


class EndSessionRequest(BaseModel):
    session_id: str


class EndSessionResponse(BaseModel):
    session_id: str
    message: str
    issue_id: Optional[str] = None


class VoiceAudioRequest(BaseModel):
    session_id: str


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None


class PriorityScoreRequest(BaseModel):
    issue_id: str
    image_url: Optional[str] = None
    description: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    issue_type: Optional[str] = None


class ClassifyImageRequest(BaseModel):
    image_url: str


class ClassifyImageResponse(BaseModel):
    success: bool
    isValid: bool
    isUnrelated: bool
    issueType: Optional[str] = None
    className: Optional[str] = None
    confidence: float
    message: str
    allPredictions: List[Dict[str, Any]] = []
    description: Optional[str] = None


class GenerateDescriptionRequest(BaseModel):
    image_url: str
    issue_type: str


class GenerateDescriptionResponse(BaseModel):
    success: bool
    description: Optional[str] = None
    error: Optional[str] = None


# ============================================
# Health & Config Endpoints
# ============================================

@app.get("/agent/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return HealthResponse(
        status="ok",
        timestamp=datetime.utcnow().isoformat(),
        services={
            "bedrock": config.bedrock.is_configured,
            "polly_tts": config.polly.is_configured,
            "transcribe_stt": config.transcribe.is_configured,
            "weather": config.weather.is_configured,
            "dynamodb": config.dynamodb.is_configured,
        }
    )


@app.get("/agent/config", response_model=ConfigResponse)
async def get_config():
    """Get client configuration"""
    return ConfigResponse(
        whisper_enabled=config.transcribe.is_configured,
        tts_enabled=config.polly.is_configured,
        weather_enabled=config.weather.is_configured,
    )


# ============================================
# Chat Agent Endpoints
# ============================================

@app.post("/agent/chat/start", response_model=StartSessionResponse)
async def start_chat_session(request: StartSessionRequest):
    """Start a new chat session"""
    from agents.chat_agent import ChatAgent

    session = ConversationSession(
        is_voice=request.is_voice,
        user_agent=request.user_agent,
    )

    # Initialize chat agent and get greeting
    agent = ChatAgent(session)
    greeting = await agent.get_greeting()

    session.add_message(MessageRole.ASSISTANT, greeting)
    sessions[session.id] = session

    return StartSessionResponse(
        session_id=session.id,
        message=greeting,
        state=session.state.value,
    )


@app.post("/agent/chat/message", response_model=ChatMessageResponse)
async def send_chat_message(request: ChatMessageRequest):
    """Send a message in an existing chat session"""
    from agents.chat_agent import ChatAgent

    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Add user message
    session.add_message(
        role=MessageRole.USER,
        content=request.message,
        image_url=request.image_url,
        location=request.location,
    )

    # Process with chat agent
    try:
        agent = ChatAgent(session)
        response = await agent.process_message(
            message=request.message,
            image_url=request.image_url,
            location=request.location,
        )
    except Exception as e:
        import traceback
        print(f"[ERROR] Chat message processing failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    # Add assistant response
    session.add_message(MessageRole.ASSISTANT, response["message"])

    # Check if issue was submitted
    issue_id = None
    if session.state == ConversationState.COMPLETED:
        issue_id = session.get_collected_data("issue_id")

    return ChatMessageResponse(
        session_id=session.id,
        message=response["message"],
        state=session.state.value,
        collected_data=session.collected_data,
        is_complete=session.has_required_data(),
        missing_fields=session.get_missing_fields(),
        issue_id=issue_id,
    )


@app.post("/agent/chat/end", response_model=EndSessionResponse)
async def end_chat_session(request: EndSessionRequest):
    """End a chat session"""
    session = sessions.pop(request.session_id, None)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    issue_id = session.get_collected_data("issue_id")

    return EndSessionResponse(
        session_id=request.session_id,
        message="Session ended. Thank you for using CivicLemma!",
        issue_id=issue_id,
    )


# ============================================
# Voice Agent Endpoints
# ============================================

@app.post("/agent/voice/start", response_model=StartSessionResponse)
async def start_voice_session(request: StartSessionRequest):
    """Start a new voice session"""
    request.is_voice = True
    return await start_chat_session(request)


@app.post("/agent/voice/audio")
async def process_voice_audio(
    session_id: str = Form(...),
    audio: UploadFile = File(...),
):
    """Process voice audio and return response"""
    from agents.voice_agent import VoiceAgent

    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Read audio data
    audio_data = await audio.read()

    # Process with voice agent
    agent = VoiceAgent(session)
    result = await agent.process_audio(audio_data, audio.content_type or "audio/webm")

    return {
        "session_id": session_id,
        "transcription": result["transcription"],
        "response_text": result["response_text"],
        "response_audio_url": result.get("response_audio_url"),
        "state": session.state.value,
        "collected_data": session.collected_data,
        "is_complete": session.has_required_data(),
    }


@app.post("/agent/voice/tts")
async def text_to_speech(request: TTSRequest):
    """Convert text to speech"""
    from services.polly import polly_service

    if not config.polly.is_configured:
        raise HTTPException(status_code=503, detail="TTS service not configured")

    audio_data = await polly_service.synthesize(request.text, request.voice)

    return StreamingResponse(
        iter([audio_data]),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=speech.mp3"},
    )


# ============================================
# Priority Agent Endpoints
# ============================================

@app.post("/agent/priority/score", response_model=PriorityScore)
async def score_issue_priority(request: PriorityScoreRequest):
    """Score priority for a single issue"""
    from agents.priority_agent import PriorityAgent

    agent = PriorityAgent()
    score = await agent.score_issue(
        issue_id=request.issue_id,
        image_url=request.image_url,
        description=request.description,
        location=request.location,
        issue_type=request.issue_type,
    )

    return score


@app.post("/agent/priority/batch", response_model=BatchPriorityResponse)
async def score_issues_batch(request: BatchPriorityRequest):
    """Score priority for multiple issues"""
    from agents.priority_agent import PriorityAgent

    agent = PriorityAgent()
    scores = []
    errors = []

    for issue_id in request.issue_ids:
        try:
            # Fetch issue data from main server
            score = await agent.score_issue_by_id(issue_id)
            scores.append(score)
        except Exception as e:
            errors.append(f"Error scoring {issue_id}: {str(e)}")

    return BatchPriorityResponse(
        scores=scores,
        total_processed=len(scores),
        errors=errors,
    )


# ============================================
# Image Classification Endpoint
# ============================================

# Map GPT-4o detected classes to app issue types
ISSUE_TYPE_MAPPING = {
    "pothole": "POTHOLE",
    "road damage": "POTHOLE",
    "potholes": "POTHOLE",
    "garbage": "GARBAGE",
    "trash": "GARBAGE",
    "litter": "GARBAGE",
    "littering": "GARBAGE",
    "waste": "GARBAGE",
    "illegal parking": "ILLEGAL_PARKING",
    "parking violation": "ILLEGAL_PARKING",
    "wrongly parked": "ILLEGAL_PARKING",
    "street light": "STREET_LIGHT",
    "streetlight": "STREET_LIGHT",
    "broken light": "STREET_LIGHT",
    "lamp post": "STREET_LIGHT",
    "water leak": "WATER_LEAKAGE",
    "water leakage": "WATER_LEAKAGE",
    "pipe burst": "WATER_LEAKAGE",
    "flooding": "WATER_LEAKAGE",
    "road crack": "ROAD_DAMAGE",
    "damaged road": "ROAD_DAMAGE",
    "broken road": "ROAD_DAMAGE",
    "fallen tree": "FALLEN_TREE",
    "tree down": "FALLEN_TREE",
    "uprooted tree": "FALLEN_TREE",
    "graffiti": "GRAFFITI",
    "vandalism": "GRAFFITI",
    "defaced": "GRAFFITI",
    "damaged sign": "DAMAGED_SIGN",
    "broken sign": "DAMAGED_SIGN",
    "road sign": "DAMAGED_SIGN",
    "dead animal": "DEAD_ANIMAL",
    "animal carcass": "DEAD_ANIMAL",
    "damaged concrete": "DAMAGED_CONCRETE",
    "broken concrete": "DAMAGED_CONCRETE",
    "cracked sidewalk": "DAMAGED_CONCRETE",
    "electrical": "DAMAGED_ELECTRICAL",
    "power line": "DAMAGED_ELECTRICAL",
    "electric pole": "DAMAGED_ELECTRICAL",
    "wires": "DAMAGED_ELECTRICAL",
}


@app.post("/agent/classify", response_model=ClassifyImageResponse)
async def classify_image(request: ClassifyImageRequest):
    """Classify an image using Bedrock vision"""
    from services.bedrock import bedrock_service

    if not config.bedrock.is_configured:
        raise HTTPException(status_code=503, detail="Bedrock not configured")

    try:
        # Use GPT-4o vision to classify the image
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

        result = await bedrock_service.analyze_image(
            image_url=request.image_url,
            prompt=classification_prompt,
        )

        # Parse the JSON response
        import json
        try:
            # Extract JSON from the response
            response_text = result.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]

            data = json.loads(response_text)
        except json.JSONDecodeError:
            # If JSON parsing fails, try to extract key information
            data = {
                "is_civic_issue": "civic issue" in result.lower() or "municipal" in result.lower(),
                "issue_type": None,
                "confidence": 0.6,
                "reasoning": result,
                "description": result[:200] if len(result) > 200 else result,
            }

        is_civic = data.get("is_civic_issue", False)
        issue_type_raw = data.get("issue_type", "").lower() if data.get("issue_type") else ""
        confidence = data.get("confidence", 0.7)
        description = data.get("description", "")

        # Map to app issue type
        mapped_issue_type = None
        class_name = data.get("issue_type")

        for key, value in ISSUE_TYPE_MAPPING.items():
            if key in issue_type_raw:
                mapped_issue_type = value
                break

        # If no match found but it's a civic issue, default to OTHER
        if is_civic and not mapped_issue_type:
            mapped_issue_type = "OTHER"

        return ClassifyImageResponse(
            success=True,
            isValid=is_civic,
            isUnrelated=not is_civic,
            issueType=mapped_issue_type,
            className=class_name,
            confidence=confidence,
            message=data.get("reasoning", "Image analyzed successfully"),
            allPredictions=[{"className": class_name, "probability": confidence}] if class_name else [],
            description=description,
        )

    except Exception as e:
        print(f"Classification error: {e}")
        return ClassifyImageResponse(
            success=False,
            isValid=False,
            isUnrelated=True,
            issueType=None,
            className=None,
            confidence=0,
            message=f"Classification failed: {str(e)}",
            allPredictions=[],
            description=None,
        )


@app.post("/agent/generate-description", response_model=GenerateDescriptionResponse)
async def generate_description(request: GenerateDescriptionRequest):
    """Generate a description for an issue image using Bedrock vision"""
    from services.bedrock import bedrock_service

    if not config.bedrock.is_configured:
        raise HTTPException(status_code=503, detail="Bedrock not configured")

    try:
        issue_type_display = request.issue_type.replace("_", " ").title()

        description_prompt = f"""You are helping a citizen report a civic infrastructure issue to their local municipality.

The image shows a {issue_type_display} issue.

Write a clear, professional, and concise description (2-3 sentences) for this issue report that:
1. Describes what you can see in the image
2. Notes the apparent severity or condition
3. Mentions any relevant details that would help the municipality understand and address the issue

Write ONLY the description text, nothing else. Do not include greetings, labels, or formatting."""

        description = await bedrock_service.analyze_image(
            image_url=request.image_url,
            prompt=description_prompt,
        )

        # Clean up the description
        description = description.strip()
        # Remove any markdown or quotes
        if description.startswith('"') and description.endswith('"'):
            description = description[1:-1]
        if description.startswith("Description:"):
            description = description[12:].strip()

        return GenerateDescriptionResponse(
            success=True,
            description=description,
            error=None,
        )

    except Exception as e:
        print(f"Description generation error: {e}")
        return GenerateDescriptionResponse(
            success=False,
            description=None,
            error=str(e),
        )


# ============================================
# Main Entry Point
# ============================================

if __name__ == "__main__":
    port = int(os.environ.get("AGENT_PORT", 8001))
    print(f"\nStarting Agent Service on http://localhost:{port}")
    print("Endpoints:")
    print("  GET  /agent/health - Health check")
    print("  GET  /agent/config - Client configuration")
    print("  POST /agent/chat/start - Start chat session")
    print("  POST /agent/chat/message - Send chat message")
    print("  POST /agent/chat/end - End chat session")
    print("  POST /agent/voice/start - Start voice session")
    print("  POST /agent/voice/audio - Process voice audio")
    print("  POST /agent/voice/tts - Text to speech")
    print("  POST /agent/priority/score - Score single issue")
    print("  POST /agent/priority/batch - Score multiple issues")
    print("  GET  /docs - API documentation")
    print("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=port)
