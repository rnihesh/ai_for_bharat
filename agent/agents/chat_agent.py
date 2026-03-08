"""
Chat Agent for conversational issue reporting
"""

from typing import Dict, Any, Optional
from models.conversation import ConversationSession, ConversationState, MessageRole
from models.issue import CollectedIssueData, LocationData, IssueType
from agents.base_agent import BaseAgent
from tools.image_tools import ImageTools
from tools.location_tools import LocationTools
from tools.issue_tools import IssueTools


class ChatAgent(BaseAgent):
    """
    Chat agent for guiding users through issue reporting.
    Uses a hybrid approach: guided flow with free-form understanding.
    """

    def get_system_prompt(self) -> str:
        """Get the chat agent system prompt"""
        return """You are a helpful assistant for CivicLemma, a civic issue reporting platform in India.

Your role is to help citizens report local infrastructure issues like potholes, garbage, illegal parking, damaged signs, fallen trees, vandalism, and more.

IMPORTANT GUIDELINES:
1. Be friendly, professional, and concise
2. Never ask for personal information - reports are anonymous
3. Guide users through the reporting process naturally
4. Extract information from user messages instead of asking repeatedly
5. Required information: at least one image, location, and issue description
6. If the user provides multiple pieces of information at once, acknowledge all of them

MULTILINGUAL SUPPORT:
- Respond in the SAME LANGUAGE the user speaks
- If user speaks Hindi, respond in Hindi
- If user speaks Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, or Punjabi - respond in that language
- If user mixes languages (Hinglish, etc.), you can respond similarly
- Always be culturally appropriate for Indian users

CONVERSATION FLOW:
1. Greet the user and ask about the issue they want to report
2. When they describe an issue, acknowledge it and ask for a photo
3. Once you have the photo, ask for the location (or offer to use their device location)
4. Confirm all details before submission
5. Submit the issue and provide the reference number

RESPONSE STYLE:
- Keep responses brief (2-3 sentences max)
- Use simple, clear language
- Do not use emojis
- Be helpful and reassuring
- If something is unclear, ask ONE clarifying question

Current collected data will be provided. Only ask for missing information."""

    async def get_greeting(self) -> str:
        """Get an appropriate greeting message"""
        return "Hello! I am here to help you report a civic issue in your area. What would you like to report today? You can describe the problem - whether it is a pothole, garbage, illegal parking, or any other infrastructure issue."

    async def process_message(
        self,
        message: str,
        image_url: Optional[str] = None,
        location: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Process a user message and generate response

        Args:
            message: User's text message
            image_url: Optional image URL if user uploaded an image
            location: Optional location coordinates

        Returns:
            Response dict with message and updated state
        """
        # Process any provided data first
        if image_url:
            await self._process_image(image_url)

        if location:
            await self._process_location(location)

        # Extract information from the message
        await self._extract_from_message(message)

        # Generate appropriate response based on state
        response = await self._generate_contextual_response(message)

        return {
            "message": response,
            "state": self.session.state.value if self.session else "unknown",
        }

    async def _process_image(self, image_url: str) -> None:
        """Process an uploaded image"""
        print(f"[ChatAgent] Processing image: {image_url[:50]}...")

        # Add image to collected data
        image_urls = self.get_collected_data("image_urls", [])
        if image_url not in image_urls:
            image_urls.append(image_url)
            self.set_collected_data("image_urls", image_urls)
            print(f"[ChatAgent] Image added. Total images: {len(image_urls)}")

        # Analyze image to extract issue type
        try:
            analysis = await ImageTools.analyze_issue_image(image_url)
            detected_type = analysis.get("detected_type")
            description = analysis.get("description")

            if detected_type and detected_type != "unknown":
                # Map to IssueType enum
                issue_type = IssueTools.map_ml_type_to_issue_type(detected_type)
                if issue_type:
                    self.set_collected_data("issue_type", issue_type)
                    self.set_collected_data("detected_issue_type", detected_type)
                    print(f"[ChatAgent] Detected issue type: {issue_type}")

            if description and not self.get_collected_data("description"):
                self.set_collected_data("ai_description", description)
                print(f"[ChatAgent] AI description set: {description[:50]}...")

        except Exception as e:
            print(f"[ChatAgent] Error analyzing image: {e}")

    async def _process_location(self, location: Dict[str, float]) -> None:
        """Process provided location"""
        lat = location.get("lat") or location.get("latitude")
        lng = location.get("lng") or location.get("longitude")

        print(f"[ChatAgent] Processing location: lat={lat}, lng={lng}")

        if lat and lng:
            # Reverse geocode for address
            try:
                address_info = await LocationTools.reverse_geocode(lat, lng)
                location_data = LocationData(
                    latitude=lat,
                    longitude=lng,
                    address=address_info.get("formatted_address"),
                    city=address_info.get("city"),
                    state=address_info.get("state"),
                    district=address_info.get("district"),
                    pincode=address_info.get("pincode"),
                    geohash=LocationTools.encode_geohash(lat, lng),
                )
                self.set_collected_data("location", location_data)
                print(f"[ChatAgent] Location set with address: {location_data.address}")
            except Exception as e:
                print(f"[ChatAgent] Error geocoding location: {e}")
                # Still save basic location
                location_data = LocationData(latitude=lat, longitude=lng)
                self.set_collected_data("location", location_data)
                print(f"[ChatAgent] Location set with coordinates only")

    async def _extract_from_message(self, message: str) -> None:
        """Extract information from user's message"""
        message_lower = message.lower()

        # Check for confirmation/denial
        intent = self.extract_intent(message)
        state = self.session.state if self.session else None
        print(f"[ChatAgent] _extract_from_message - State: {state}, Intent: {intent}")

        # Try to extract location coordinates from message (format: "lat, lng" or "lat,lng")
        import re
        coord_pattern = r'(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)'
        coord_match = re.search(coord_pattern, message)
        if coord_match and not self.get_collected_data("location"):
            try:
                lat = float(coord_match.group(1))
                lng = float(coord_match.group(2))
                # Validate coordinates are reasonable for India
                if 6 <= lat <= 38 and 68 <= lng <= 98:
                    print(f"[ChatAgent] Extracted coordinates from message: {lat}, {lng}")
                    await self._process_location({"lat": lat, "lng": lng})
            except (ValueError, IndexError):
                pass

        # IMPORTANT: Extract issue type keywords EARLY - before any confirmation handling
        # This ensures we capture issue types even in messages that also contain confirmations
        self._extract_issue_type_keywords(message_lower)

        # Extract issue description from user's message EARLY
        # User's explicit description should always take priority over AI-generated description
        if not self.get_collected_data("description"):
            is_substantial = len(message) > 15
            is_just_coordinates = bool(coord_match) and len(message.strip()) < 25
            is_just_confirmation = intent.get("intent") in ["confirm", "deny"]
            # Check for various location sharing messages
            is_just_location_share = (
                ("sharing" in message_lower and "location" in message_lower) or
                ("here is my" in message_lower and "location" in message_lower) or
                ("my location" in message_lower and len(message) < 40) or
                (message_lower.strip() in ["here is my location", "here is my current location", "sharing location", "my location"])
            )

            if is_substantial and not is_just_coordinates and not is_just_confirmation and not is_just_location_share:
                self.set_collected_data("description", message)
                print(f"[ChatAgent] Extracted description from user message: {message[:50]}...")

        # Handle mismatch resolution
        if "use image" in message_lower or "use the image" in message_lower or "use photo" in message_lower:
            # User wants to use the detected type from image
            detected_type = self.get_collected_data("issue_type")
            if detected_type:
                self.set_collected_data("mismatch_confirmed", True)
                self.set_collected_data("user_stated_issue_type", None)  # Clear user's stated type
                print(f"[ChatAgent] User chose to use image-detected type: {detected_type}")

        elif "use my description" in message_lower or "use my" in message_lower or "use description" in message_lower:
            # User wants to use their stated type
            user_stated_type = self.get_collected_data("user_stated_issue_type")
            if user_stated_type:
                self.set_collected_data("issue_type", user_stated_type)
                self.set_collected_data("mismatch_confirmed", True)
                print(f"[ChatAgent] User chose to use their stated type: {user_stated_type}")

        # Handle confirmation intent - submit if we have all required data
        if intent.get("intent") == "confirm":
            # Check if we have all required data
            has_image = bool(self.get_collected_data("image_urls"))
            has_location = bool(self.get_collected_data("location"))
            has_description = bool(self.get_collected_data("description") or self.get_collected_data("ai_description"))

            # Check if there's an unresolved mismatch
            user_stated_type = self.get_collected_data("user_stated_issue_type")
            detected_type = self.get_collected_data("issue_type")
            mismatch_confirmed = self.get_collected_data("mismatch_confirmed", False)
            has_unresolved_mismatch = user_stated_type and detected_type and user_stated_type != detected_type and not mismatch_confirmed

            if has_image and has_location and has_description and not has_unresolved_mismatch:
                print(f"[ChatAgent] User confirmed with all data present, submitting issue...")
                self.update_session_state(ConversationState.SUBMITTING)
                await self._submit_issue()
                return

        if intent.get("intent") == "deny":
            # Let user correct information
            self.update_session_state(ConversationState.COLLECTING_ISSUE)
            return

    def _extract_issue_type_keywords(self, message_lower: str) -> None:
        """Extract issue type from keywords in the message (English + Hindi)"""
        # Map user keywords to valid issue types (based on server's ISSUE_TYPES)
        # Includes both English and Hindi/regional language keywords
        issue_type_keywords = {
            # Potholes & Road Damage (English + Hindi)
            "pothole": IssueType.POTHOLE,
            "road damage": IssueType.POTHOLE,
            "road crack": IssueType.POTHOLE,
            "गड्ढा": IssueType.POTHOLE,  # gadha - pothole
            "गड्ढे": IssueType.POTHOLE,  # gadhe - potholes
            "सड़क": IssueType.POTHOLE,  # sadak - road (context: damaged road)
            "रोड": IssueType.POTHOLE,  # road
            # Garbage/Littering (English + Hindi)
            "garbage": IssueType.GARBAGE,
            "trash": IssueType.GARBAGE,
            "littering": IssueType.GARBAGE,
            "waste": IssueType.GARBAGE,
            "rubbish": IssueType.GARBAGE,
            "कचरा": IssueType.GARBAGE,  # kachra - garbage
            "कूड़ा": IssueType.GARBAGE,  # kooda - trash
            "गंदगी": IssueType.GARBAGE,  # gandagi - filth/dirt
            "कूड़ेदान": IssueType.GARBAGE,  # koodedaan - dustbin overflow
            # Illegal Parking (English + Hindi)
            "parking": IssueType.ILLEGAL_PARKING,
            "parked": IssueType.ILLEGAL_PARKING,
            "पार्किंग": IssueType.ILLEGAL_PARKING,  # parking
            "गाड़ी खड़ी": IssueType.ILLEGAL_PARKING,  # gaadi khadi - vehicle parked
            # Signs (English + Hindi)
            "sign": IssueType.DAMAGED_SIGN,
            "board": IssueType.DAMAGED_SIGN,
            "साइन": IssueType.DAMAGED_SIGN,  # sign
            "बोर्ड": IssueType.DAMAGED_SIGN,  # board
            # Trees (English + Hindi)
            "tree": IssueType.FALLEN_TREE,
            "branch": IssueType.FALLEN_TREE,
            "पेड़": IssueType.FALLEN_TREE,  # ped - tree
            "डाली": IssueType.FALLEN_TREE,  # daali - branch
            # Vandalism/Graffiti (English + Hindi)
            "graffiti": IssueType.VANDALISM,
            "vandalism": IssueType.VANDALISM,
            "defaced": IssueType.VANDALISM,
            "तोड़फोड़": IssueType.VANDALISM,  # todfod - vandalism
            # Dead Animals (English + Hindi)
            "dead animal": IssueType.DEAD_ANIMAL,
            "animal carcass": IssueType.DEAD_ANIMAL,
            "मरा हुआ जानवर": IssueType.DEAD_ANIMAL,  # mara hua jaanvar
            "मृत पशु": IssueType.DEAD_ANIMAL,  # mrit pashu
            # Concrete/Infrastructure (English + Hindi)
            "concrete": IssueType.DAMAGED_CONCRETE,
            "sidewalk": IssueType.DAMAGED_CONCRETE,
            "pavement": IssueType.DAMAGED_CONCRETE,
            "sewage": IssueType.DAMAGED_CONCRETE,
            "drainage": IssueType.DAMAGED_CONCRETE,
            "manhole": IssueType.DAMAGED_CONCRETE,
            "नाली": IssueType.DAMAGED_CONCRETE,  # naali - drain
            "सीवर": IssueType.DAMAGED_CONCRETE,  # sewer
            "मेनहोल": IssueType.DAMAGED_CONCRETE,  # manhole
            "फुटपाथ": IssueType.DAMAGED_CONCRETE,  # footpath
            # Electrical (English + Hindi)
            "electric": IssueType.DAMAGED_ELECTRICAL,
            "wire": IssueType.DAMAGED_ELECTRICAL,
            "pole": IssueType.DAMAGED_ELECTRICAL,
            "cable": IssueType.DAMAGED_ELECTRICAL,
            "street light": IssueType.DAMAGED_ELECTRICAL,
            "streetlight": IssueType.DAMAGED_ELECTRICAL,
            "lamp": IssueType.DAMAGED_ELECTRICAL,
            "light": IssueType.DAMAGED_ELECTRICAL,
            "बिजली": IssueType.DAMAGED_ELECTRICAL,  # bijli - electricity
            "तार": IssueType.DAMAGED_ELECTRICAL,  # taar - wire
            "खंभा": IssueType.DAMAGED_ELECTRICAL,  # khamba - pole
            "स्ट्रीट लाइट": IssueType.DAMAGED_ELECTRICAL,  # street light
            "बत्ती": IssueType.DAMAGED_ELECTRICAL,  # batti - light
        }

        for keyword, issue_type in issue_type_keywords.items():
            if keyword in message_lower:
                # Set the issue type directly (will be overridden by image if different)
                if not self.get_collected_data("issue_type"):
                    self.set_collected_data("issue_type", issue_type)
                # Also store user's stated type for mismatch detection
                self.set_collected_data("user_stated_issue_type", issue_type)
                print(f"[ChatAgent] User mentioned issue type: {issue_type}, setting as primary")
                break

    async def _generate_contextual_response(self, user_message: str) -> str:
        """Generate a context-aware response"""
        state = self.session.state if self.session else ConversationState.GREETING
        collected = self.session.collected_data if self.session else {}

        print(f"[ChatAgent] Generating response for state: {state.value}")
        print(f"[ChatAgent] Collected data keys: {list(collected.keys())}")

        # Build context for LLM
        context_parts = []

        # Use description or AI-generated description
        desc = collected.get("description") or collected.get("ai_description")
        if desc:
            context_parts.append(f"Issue description: {desc}")

        if collected.get("issue_type"):
            issue_type = collected["issue_type"]
            label = IssueTools.get_issue_type_label(issue_type) if isinstance(issue_type, IssueType) else str(issue_type)
            context_parts.append(f"Issue type: {label}")

        if collected.get("image_urls"):
            context_parts.append(f"Images uploaded: {len(collected['image_urls'])}")

        if collected.get("location"):
            loc = collected["location"]
            if isinstance(loc, LocationData):
                context_parts.append(f"Location: {loc.address or f'{loc.latitude}, {loc.longitude}'}")
            elif isinstance(loc, dict):
                addr = loc.get('address') or f"{loc.get('latitude')}, {loc.get('longitude')}"
                context_parts.append(f"Location: {addr}")

        missing = []
        # Check for description or AI-generated description
        if not collected.get("description") and not collected.get("ai_description"):
            missing.append("issue description")
        if not collected.get("image_urls"):
            missing.append("photo of the issue")
        if not collected.get("location"):
            missing.append("location")

        if missing:
            context_parts.append(f"Still needed: {', '.join(missing)}")

        context_parts.append(f"Current state: {state.value}")

        context = "\n".join(context_parts)

        # Handle specific states
        print(f"[ChatAgent] Checking state handlers, current state: {state.value}")

        if state == ConversationState.SUBMITTING:
            issue_id = self.get_collected_data("issue_id")
            print(f"[ChatAgent] SUBMITTING state - issue_id: {issue_id}")
            if issue_id:
                self.update_session_state(ConversationState.COMPLETED)
                return f"Your issue has been submitted successfully. Your reference number is {issue_id}. The relevant municipality will be notified and you can track the status on our platform. Is there anything else you would like to report?"
            else:
                error = self.get_collected_data("submit_error")
                return f"I apologize, but there was an error submitting your report: {error or 'Unknown error'}. Please try again or use the standard reporting form on our website."

        if state == ConversationState.COMPLETED:
            issue_id = self.get_collected_data("issue_id")
            print(f"[ChatAgent] COMPLETED state - issue_id: {issue_id}")
            if issue_id:
                return f"Your issue (Reference: {issue_id}) has been submitted. The municipality has been notified. Would you like to report another issue?"
            return "Thank you for reporting this issue. The municipality has been notified. Would you like to report another issue?"

        if state == ConversationState.ERROR:
            error = self.get_collected_data("submit_error")
            print(f"[ChatAgent] ERROR state - error: {error}")
            return f"I apologize, but there was an error: {error or 'Unknown error'}. Please try again or use the standard reporting form."

        # Check for mismatch between user's stated issue type and AI-detected type
        user_stated_type = collected.get("user_stated_issue_type")
        detected_type = collected.get("issue_type")
        mismatch_confirmed = collected.get("mismatch_confirmed", False)

        if user_stated_type and detected_type and user_stated_type != detected_type and not mismatch_confirmed:
            user_type_label = IssueTools.get_issue_type_label(user_stated_type) if isinstance(user_stated_type, IssueType) else str(user_stated_type)
            detected_type_label = IssueTools.get_issue_type_label(detected_type) if isinstance(detected_type, IssueType) else str(detected_type)

            print(f"[ChatAgent] Mismatch detected - User said: {user_type_label}, Image shows: {detected_type_label}")

            # Check if user is confirming the mismatch
            intent = self.extract_intent(user_message)
            if intent.get("intent") == "confirm":
                # User confirmed, use the detected type from image
                self.set_collected_data("mismatch_confirmed", True)
                print(f"[ChatAgent] User confirmed mismatch, using detected type: {detected_type}")
            else:
                # Ask user to confirm
                return f"I notice a mismatch: You mentioned **{user_type_label}**, but the image appears to show **{detected_type_label}**.\n\nWhich would you like to report?\n1. Say 'use image' to report as {detected_type_label} (based on the photo)\n2. Say 'use my description' to report as {user_type_label}\n3. Upload a different photo that matches your description"

        # When all data is collected, auto-submit instead of asking for confirmation
        print(f"[ChatAgent] Missing fields: {missing}, State: {state.value}")

        # Check if already submitted or submitting
        already_handled = state in [ConversationState.COMPLETED, ConversationState.SUBMITTING, ConversationState.ERROR]

        # Auto-submit when all data is collected
        if not missing and not already_handled:
            print(f"[ChatAgent] All data collected, auto-submitting...")
            # Build summary
            loc = collected.get("location")
            address = ""
            if isinstance(loc, LocationData):
                address = loc.address or f"{loc.latitude:.6f}, {loc.longitude:.6f}"
            elif isinstance(loc, dict):
                address = loc.get("address") or f"{loc.get('latitude', 0):.6f}, {loc.get('longitude', 0):.6f}"

            issue_type = collected.get("issue_type")
            type_label = IssueTools.get_issue_type_label(issue_type) if isinstance(issue_type, IssueType) else "Civic Issue"

            # Auto-submit the issue
            self.update_session_state(ConversationState.SUBMITTING)
            await self._submit_issue()

            # Check if submission was successful
            issue_id = self.get_collected_data("issue_id")
            if issue_id:
                self.update_session_state(ConversationState.COMPLETED)
                return f"I have submitted your report. Here is a summary:\n\n- Issue: {type_label}\n- Location: {address}\n- Photos: {len(collected.get('image_urls', []))}\n\nYour reference number is: {issue_id}\n\nThe relevant municipality has been notified. Is there anything else you would like to report?"
            else:
                error = self.get_collected_data("submit_error")
                return f"I apologize, but there was an error submitting your report: {error or 'Please try again'}. You can also use the standard reporting form on our website."

        # Use LLM for natural response
        print(f"[ChatAgent] Falling through to LLM response (state: {state.value})")
        response = await self.generate_response(
            user_message=user_message,
            additional_context=context,
        )

        return response

    async def _submit_issue(self) -> None:
        """Submit the collected issue"""
        collected = self.session.collected_data if self.session else {}

        location = collected.get("location")
        if isinstance(location, dict):
            location = LocationData(**location)

        # Use description or fall back to AI-generated description
        description = collected.get("description") or collected.get("ai_description")

        # Ensure description meets minimum length
        if description and len(description) < 10:
            description = f"Issue reported: {description}"

        # Use issue_type, falling back to user_stated_issue_type if not set
        issue_type = collected.get("issue_type") or collected.get("user_stated_issue_type")
        print(f"[ChatAgent] Submit - issue_type: {issue_type}, description: {description[:50] if description else 'None'}...")

        issue_data = CollectedIssueData(
            description=description,
            issue_type=issue_type,
            image_urls=collected.get("image_urls", []),
            location=location,
        )

        try:
            result = await IssueTools.submit_issue(issue_data)

            if result.get("success"):
                issue_id = result.get("issue_id")
                self.set_collected_data("issue_id", issue_id)
                self.update_session_state(ConversationState.COMPLETED)

                # Score priority in background (don't block response)
                try:
                    from agents.priority_agent import PriorityAgent
                    priority_agent = PriorityAgent()
                    loc_dict = None
                    if location:
                        loc_dict = {"lat": location.latitude, "lng": location.longitude}
                    priority_score = await priority_agent.score_issue(
                        issue_id=issue_id,
                        image_url=issue_data.image_urls[0] if issue_data.image_urls else None,
                        description=description,
                        location=loc_dict,
                        issue_type=issue_data.issue_type.value if issue_data.issue_type else None,
                    )
                    print(f"[ChatAgent] Priority scored: {priority_score.severity.value} (score: {priority_score.score})")
                except Exception as pe:
                    print(f"[ChatAgent] Priority scoring failed (non-blocking): {pe}")
            else:
                self.set_collected_data("submit_error", result.get("error"))
                self.update_session_state(ConversationState.ERROR)

        except Exception as e:
            print(f"Error submitting issue: {e}")
            self.set_collected_data("submit_error", str(e))
            self.update_session_state(ConversationState.ERROR)
