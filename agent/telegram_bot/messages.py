"""
Multilingual message templates for Telegram bot
Supports English, Hindi, and other Indian languages
"""

from typing import Dict


# Message templates by language
MESSAGES: Dict[str, Dict[str, str]] = {
    "en": {
        "welcome": (
            "Welcome to CivicLemma!\n\n"
            "I help you report civic issues like potholes, garbage, illegal parking, and more.\n\n"
            "To report an issue:\n"
            "1. Send a photo of the problem\n"
            "2. Share your location\n\n"
            "That's it! I'll handle the rest."
        ),
        "analyzing": "Analyzing your image...",
        "detected_issue": (
            "I detected **{issue_type}** with {confidence}% confidence.\n\n"
            "{description}\n\n"
            "Would you like to report this issue?"
        ),
        "no_issue_detected": (
            "I couldn't detect a civic issue in this image.\n\n"
            "If you believe this shows a problem, please describe it and I'll help you report it."
        ),
        "share_location": (
            "Please share your location so I can complete the report.\n\n"
            "Tap the attachment icon (paperclip) and select 'Location'."
        ),
        "location_received": "Location received: {address}",
        "submitting": "Submitting your report...",
        "submitted": (
            "Your issue has been submitted!\n\n"
            "- Issue: {issue_type}\n"
            "- Location: {address}\n"
            "- Reference: `{issue_id}`\n\n"
            "The municipality has been notified. Thank you for helping improve your community!"
        ),
        "submit_error": (
            "Sorry, there was an error submitting your report: {error}\n\n"
            "Please try again or use our web platform at civiclemma.in"
        ),
        "help": (
            "Here's how to use CivicLemma:\n\n"
            "**Report an issue:**\n"
            "1. Send a photo of the problem\n"
            "2. Share your location\n\n"
            "**Commands:**\n"
            "/start - Start a new conversation\n"
            "/help - Show this help message\n"
            "/cancel - Cancel current report\n\n"
            "You can also describe issues in Hindi or other Indian languages!"
        ),
        "cancelled": "Report cancelled. Send a photo whenever you want to report a new issue.",
        "confirm_yes": "Yes, report it",
        "confirm_no": "No, cancel",
        "request_description": "Please describe the issue you want to report.",
        "processing": "Processing your message...",
        "session_expired": "Your session has expired. Send /start to begin a new report.",
        "generic_error": "Something went wrong. Please try again.",
    },
    "hi": {
        "welcome": (
            "CivicLemma में आपका स्वागत है!\n\n"
            "मैं आपको गड्ढे, कचरा, गलत पार्किंग जैसी समस्याओं की रिपोर्ट करने में मदद करता हूं।\n\n"
            "समस्या रिपोर्ट करने के लिए:\n"
            "1. समस्या की फोटो भेजें\n"
            "2. अपना स्थान साझा करें\n\n"
            "बस इतना ही! बाकी मैं संभाल लूंगा।"
        ),
        "analyzing": "आपकी छवि का विश्लेषण हो रहा है...",
        "detected_issue": (
            "मुझे **{issue_type}** मिला ({confidence}% विश्वास)।\n\n"
            "{description}\n\n"
            "क्या आप इसकी रिपोर्ट करना चाहते हैं?"
        ),
        "no_issue_detected": (
            "इस छवि में मुझे कोई समस्या नहीं मिली।\n\n"
            "अगर आपको लगता है कि यह कोई समस्या दिखाती है, तो कृपया इसका वर्णन करें।"
        ),
        "share_location": (
            "रिपोर्ट पूरी करने के लिए कृपया अपना स्थान साझा करें।\n\n"
            "अटैचमेंट आइकन (पेपरक्लिप) पर टैप करें और 'Location' चुनें।"
        ),
        "location_received": "स्थान प्राप्त: {address}",
        "submitting": "आपकी रिपोर्ट जमा हो रही है...",
        "submitted": (
            "आपकी समस्या दर्ज हो गई!\n\n"
            "- समस्या: {issue_type}\n"
            "- स्थान: {address}\n"
            "- संदर्भ: `{issue_id}`\n\n"
            "नगर निगम को सूचित कर दिया गया है। समुदाय की मदद करने के लिए धन्यवाद!"
        ),
        "submit_error": (
            "क्षमा करें, रिपोर्ट जमा करने में त्रुटि हुई: {error}\n\n"
            "कृपया पुनः प्रयास करें या civiclemma.in पर जाएं।"
        ),
        "help": (
            "CivicLemma का उपयोग कैसे करें:\n\n"
            "**समस्या रिपोर्ट करें:**\n"
            "1. समस्या की फोटो भेजें\n"
            "2. अपना स्थान साझा करें\n\n"
            "**आदेश:**\n"
            "/start - नई बातचीत शुरू करें\n"
            "/help - यह सहायता संदेश दिखाएं\n"
            "/cancel - वर्तमान रिपोर्ट रद्द करें"
        ),
        "cancelled": "रिपोर्ट रद्द। जब भी नई समस्या रिपोर्ट करना हो, फोटो भेजें।",
        "confirm_yes": "हां, रिपोर्ट करें",
        "confirm_no": "नहीं, रद्द करें",
        "request_description": "कृपया उस समस्या का वर्णन करें जिसकी आप रिपोर्ट करना चाहते हैं।",
        "processing": "आपका संदेश प्रोसेस हो रहा है...",
        "session_expired": "आपका सत्र समाप्त हो गया। नई रिपोर्ट के लिए /start भेजें।",
        "generic_error": "कुछ गलत हो गया। कृपया पुनः प्रयास करें।",
    },
    "ta": {  # Tamil
        "welcome": (
            "CivicLemma-க்கு வரவேற்கிறோம்!\n\n"
            "குழி, குப்பை, தவறான பார்க்கிங் போன்ற பிரச்சனைகளை புகார் செய்ய உதவுகிறேன்.\n\n"
            "புகார் செய்ய:\n"
            "1. பிரச்சனையின் படம் அனுப்புங்கள்\n"
            "2. உங்கள் இருப்பிடத்தை பகிரவும்"
        ),
        "analyzing": "உங்கள் படத்தை பகுப்பாய்வு செய்கிறேன்...",
        "share_location": "புகாரை முடிக்க உங்கள் இருப்பிடத்தை பகிரவும்.",
        "submitted": (
            "உங்கள் புகார் பதிவு செய்யப்பட்டது!\n\n"
            "- பிரச்சனை: {issue_type}\n"
            "- இடம்: {address}\n"
            "- குறிப்பு: `{issue_id}`"
        ),
    },
    "te": {  # Telugu
        "welcome": (
            "CivicLemma కి స్వాగతం!\n\n"
            "గుంతలు, చెత్త, తప్పు పార్కింగ్ వంటి సమస్యలను నివేదించడంలో సహాయపడతాను.\n\n"
            "సమస్య నివేదించడానికి:\n"
            "1. సమస్య యొక్క ఫోటో పంపండి\n"
            "2. మీ స్థానాన్ని షేర్ చేయండి"
        ),
        "analyzing": "మీ చిత్రాన్ని విశ్లేషిస్తున్నాను...",
        "share_location": "నివేదికను పూర్తి చేయడానికి మీ స్థానాన్ని షేర్ చేయండి.",
        "submitted": (
            "మీ సమస్య నమోదు చేయబడింది!\n\n"
            "- సమస్య: {issue_type}\n"
            "- స్థానం: {address}\n"
            "- సూచన: `{issue_id}`"
        ),
    },
    "kn": {  # Kannada
        "welcome": (
            "CivicLemma ಗೆ ಸ್ವಾಗತ!\n\n"
            "ಗುಂಡಿಗಳು, ಕಸ, ತಪ್ಪು ಪಾರ್ಕಿಂಗ್ ಮುಂತಾದ ಸಮಸ್ಯೆಗಳನ್ನು ವರದಿ ಮಾಡಲು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.\n\n"
            "ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಲು:\n"
            "1. ಸಮಸ್ಯೆಯ ಫೋಟೋ ಕಳುಹಿಸಿ\n"
            "2. ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಹಂಚಿಕೊಳ್ಳಿ"
        ),
        "analyzing": "ನಿಮ್ಮ ಚಿತ್ರವನ್ನು ವಿಶ್ಲೇಷಿಸುತ್ತಿದ್ದೇನೆ...",
        "share_location": "ವರದಿಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಲು ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಹಂಚಿಕೊಳ್ಳಿ.",
        "submitted": (
            "ನಿಮ್ಮ ಸಮಸ್ಯೆ ದಾಖಲಾಗಿದೆ!\n\n"
            "- ಸಮಸ್ಯೆ: {issue_type}\n"
            "- ಸ್ಥಳ: {address}\n"
            "- ಉಲ್ಲೇಖ: `{issue_id}`"
        ),
    },
    "ml": {  # Malayalam
        "welcome": (
            "CivicLemma-ലേക്ക് സ്വാഗതം!\n\n"
            "കുഴികൾ, മാലിന്യം, തെറ്റായ പാർക്കിംഗ് തുടങ്ങിയ പ്രശ്നങ്ങൾ റിപ്പോർട്ട് ചെയ്യാൻ ഞാൻ സഹായിക്കുന്നു.\n\n"
            "പ്രശ്നം റിപ്പോർട്ട് ചെയ്യാൻ:\n"
            "1. പ്രശ്നത്തിന്റെ ഫോട്ടോ അയയ്ക്കുക\n"
            "2. നിങ്ങളുടെ ലൊക്കേഷൻ പങ്കിടുക"
        ),
        "analyzing": "നിങ്ങളുടെ ചിത്രം വിശകലനം ചെയ്യുന്നു...",
        "share_location": "റിപ്പോർട്ട് പൂർത്തിയാക്കാൻ നിങ്ങളുടെ ലൊക്കേഷൻ പങ്കിടുക.",
        "submitted": (
            "നിങ്ങളുടെ പ്രശ്നം രേഖപ്പെടുത്തി!\n\n"
            "- പ്രശ്നം: {issue_type}\n"
            "- സ്ഥലം: {address}\n"
            "- റഫറൻസ്: `{issue_id}`"
        ),
    },
    "mr": {  # Marathi
        "welcome": (
            "CivicLemma मध्ये स्वागत आहे!\n\n"
            "खड्डे, कचरा, चुकीचे पार्किंग अशा समस्या नोंदवण्यात मी मदत करतो.\n\n"
            "समस्या नोंदवण्यासाठी:\n"
            "1. समस्येचा फोटो पाठवा\n"
            "2. तुमचे स्थान शेअर करा"
        ),
        "analyzing": "तुमची प्रतिमा विश्लेषण करत आहे...",
        "share_location": "अहवाल पूर्ण करण्यासाठी तुमचे स्थान शेअर करा.",
        "submitted": (
            "तुमची समस्या नोंदवली गेली!\n\n"
            "- समस्या: {issue_type}\n"
            "- स्थान: {address}\n"
            "- संदर्भ: `{issue_id}`"
        ),
    },
    "bn": {  # Bengali
        "welcome": (
            "CivicLemma-তে স্বাগতম!\n\n"
            "গর্ত, আবর্জনা, ভুল পার্কিং এর মতো সমস্যা রিপোর্ট করতে আমি সাহায্য করি।\n\n"
            "সমস্যা রিপোর্ট করতে:\n"
            "1. সমস্যার ছবি পাঠান\n"
            "2. আপনার অবস্থান শেয়ার করুন"
        ),
        "analyzing": "আপনার ছবি বিশ্লেষণ করছি...",
        "share_location": "রিপোর্ট সম্পূর্ণ করতে আপনার অবস্থান শেয়ার করুন।",
        "submitted": (
            "আপনার সমস্যা রেকর্ড হয়েছে!\n\n"
            "- সমস্যা: {issue_type}\n"
            "- অবস্থান: {address}\n"
            "- রেফারেন্স: `{issue_id}`"
        ),
    },
    "gu": {  # Gujarati
        "welcome": (
            "CivicLemma માં સ્વાગત છે!\n\n"
            "ખાડા, કચરો, ખોટું પાર્કિંગ જેવી સમસ્યાઓ નોંધાવવામાં હું મદદ કરું છું.\n\n"
            "સમસ્યા નોંધાવવા:\n"
            "1. સમસ્યાનો ફોટો મોકલો\n"
            "2. તમારું સ્થાન શેર કરો"
        ),
        "analyzing": "તમારી છબીનું વિશ્લેષણ કરી રહ્યો છું...",
        "share_location": "રિપોર્ટ પૂર્ણ કરવા તમારું સ્થાન શેર કરો.",
        "submitted": (
            "તમારી સમસ્યા નોંધાઈ ગઈ!\n\n"
            "- સમસ્યા: {issue_type}\n"
            "- સ્થાન: {address}\n"
            "- સંદર્ભ: `{issue_id}`"
        ),
    },
    "pa": {  # Punjabi
        "welcome": (
            "CivicLemma ਵਿੱਚ ਜੀ ਆਇਆਂ ਨੂੰ!\n\n"
            "ਟੋਏ, ਕੂੜਾ, ਗਲਤ ਪਾਰਕਿੰਗ ਵਰਗੀਆਂ ਸਮੱਸਿਆਵਾਂ ਦੀ ਰਿਪੋਰਟ ਕਰਨ ਵਿੱਚ ਮੈਂ ਮਦਦ ਕਰਦਾ ਹਾਂ।\n\n"
            "ਸਮੱਸਿਆ ਰਿਪੋਰਟ ਕਰਨ ਲਈ:\n"
            "1. ਸਮੱਸਿਆ ਦੀ ਫੋਟੋ ਭੇਜੋ\n"
            "2. ਆਪਣੀ ਥਾਂ ਸਾਂਝੀ ਕਰੋ"
        ),
        "analyzing": "ਤੁਹਾਡੀ ਤਸਵੀਰ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ...",
        "share_location": "ਰਿਪੋਰਟ ਪੂਰੀ ਕਰਨ ਲਈ ਆਪਣੀ ਥਾਂ ਸਾਂਝੀ ਕਰੋ।",
        "submitted": (
            "ਤੁਹਾਡੀ ਸਮੱਸਿਆ ਦਰਜ ਹੋ ਗਈ!\n\n"
            "- ਸਮੱਸਿਆ: {issue_type}\n"
            "- ਥਾਂ: {address}\n"
            "- ਹਵਾਲਾ: `{issue_id}`"
        ),
    },
}


def get_message(key: str, lang: str = "en", **kwargs) -> str:
    """
    Get a localized message.

    Args:
        key: Message key
        lang: Language code (en, hi, ta, te, kn, ml, mr, bn, gu, pa)
        **kwargs: Format arguments for the message

    Returns:
        Formatted message string
    """
    # Default to English if language not found
    lang_messages = MESSAGES.get(lang, MESSAGES["en"])

    # Fall back to English if key not found in language
    message = lang_messages.get(key)
    if message is None:
        message = MESSAGES["en"].get(key, f"[{key}]")

    # Format message with provided arguments
    try:
        return message.format(**kwargs)
    except KeyError:
        return message


def detect_language(text: str) -> str:
    """
    Detect language from text (simple heuristic-based detection).

    Args:
        text: Input text

    Returns:
        Language code
    """
    # Check for Devanagari script (Hindi, Marathi)
    if any('\u0900' <= char <= '\u097F' for char in text):
        # Check for Marathi-specific words
        marathi_words = ['आहे', 'काय', 'कसे', 'नाही', 'होय']
        if any(word in text for word in marathi_words):
            return 'mr'
        return 'hi'

    # Check for Tamil script
    if any('\u0B80' <= char <= '\u0BFF' for char in text):
        return 'ta'

    # Check for Telugu script
    if any('\u0C00' <= char <= '\u0C7F' for char in text):
        return 'te'

    # Check for Kannada script
    if any('\u0C80' <= char <= '\u0CFF' for char in text):
        return 'kn'

    # Check for Malayalam script
    if any('\u0D00' <= char <= '\u0D7F' for char in text):
        return 'ml'

    # Check for Bengali script
    if any('\u0980' <= char <= '\u09FF' for char in text):
        return 'bn'

    # Check for Gujarati script
    if any('\u0A80' <= char <= '\u0AFF' for char in text):
        return 'gu'

    # Check for Gurmukhi script (Punjabi)
    if any('\u0A00' <= char <= '\u0A7F' for char in text):
        return 'pa'

    # Default to English
    return 'en'


# Issue type labels in different languages
ISSUE_TYPE_LABELS = {
    "en": {
        "POTHOLE": "Potholes & Road Damage",
        "GARBAGE": "Garbage/Littering",
        "ILLEGAL_PARKING": "Illegal Parking",
        "DAMAGED_SIGN": "Damaged Road Sign",
        "FALLEN_TREE": "Fallen Tree",
        "VANDALISM": "Vandalism/Graffiti",
        "DEAD_ANIMAL": "Dead Animal",
        "DAMAGED_CONCRETE": "Damaged Concrete",
        "DAMAGED_ELECTRICAL": "Damaged Electrical",
        "OTHER": "Other Issue",
    },
    "hi": {
        "POTHOLE": "गड्ढे और सड़क क्षति",
        "GARBAGE": "कचरा/गंदगी",
        "ILLEGAL_PARKING": "गलत पार्किंग",
        "DAMAGED_SIGN": "क्षतिग्रस्त साइनबोर्ड",
        "FALLEN_TREE": "गिरा हुआ पेड़",
        "VANDALISM": "तोड़फोड़/भित्तिचित्र",
        "DEAD_ANIMAL": "मृत जानवर",
        "DAMAGED_CONCRETE": "क्षतिग्रस्त कंक्रीट",
        "DAMAGED_ELECTRICAL": "क्षतिग्रस्त बिजली",
        "OTHER": "अन्य समस्या",
    },
}


def get_issue_type_label(issue_type: str, lang: str = "en") -> str:
    """
    Get localized issue type label.

    Args:
        issue_type: Issue type code
        lang: Language code

    Returns:
        Localized label
    """
    lang_labels = ISSUE_TYPE_LABELS.get(lang, ISSUE_TYPE_LABELS["en"])
    return lang_labels.get(issue_type, ISSUE_TYPE_LABELS["en"].get(issue_type, issue_type))
