"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Supported languages for speech recognition
const SUPPORTED_LANGUAGES = [
  { code: "en-IN", label: "English", flag: "EN" },
  { code: "hi-IN", label: "Hindi", flag: "HI" },
  { code: "ta-IN", label: "Tamil", flag: "TA" },
  { code: "te-IN", label: "Telugu", flag: "TE" },
  { code: "kn-IN", label: "Kannada", flag: "KN" },
  { code: "ml-IN", label: "Malayalam", flag: "ML" },
  { code: "mr-IN", label: "Marathi", flag: "MR" },
  { code: "bn-IN", label: "Bengali", flag: "BN" },
  { code: "gu-IN", label: "Gujarati", flag: "GU" },
  { code: "pa-IN", label: "Punjabi", flag: "PA" },
];

interface VoiceButtonProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onTranscript?: (text: string) => void;
  disabled?: boolean;
  useBrowserSTT?: boolean;
  className?: string;
  language?: string; // Language code like "en-IN", "hi-IN"
  showLanguageSelector?: boolean;
  onLanguageChange?: (language: string) => void; // Callback when language changes
}

export function VoiceButton({
  onRecordingComplete,
  onTranscript,
  disabled,
  useBrowserSTT = false,
  className,
  language: initialLanguage = "en-IN",
  showLanguageSelector = true,
  onLanguageChange,
}: VoiceButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState(initialLanguage);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        onRecordingComplete(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setInterimTranscript("");

      // If using browser STT, start speech recognition
      if (useBrowserSTT && onTranscript) {
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;

          // Set language - supports Hindi and other Indian languages
          recognition.lang = language;
          recognition.continuous = true; // Keep listening until stopped
          recognition.interimResults = true; // Show partial results

          recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = "";
            let interim = "";

            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i];
              if (result.isFinal) {
                finalTranscript += result[0].transcript;
              } else {
                interim += result[0].transcript;
              }
            }

            // Show interim results
            if (interim) {
              setInterimTranscript(interim);
            }

            // Send final transcript
            if (finalTranscript) {
              console.log(`[VoiceButton] Final transcript (${language}):`, finalTranscript);
              setInterimTranscript("");
              onTranscript(finalTranscript);
            }
          };

          recognition.onerror = (event) => {
            console.error("[VoiceButton] Speech recognition error:", event.error);
            // Don't stop on 'no-speech' error, just continue listening
            if (event.error !== "no-speech" && event.error !== "aborted") {
              setInterimTranscript("");
            }
          };

          recognition.onend = () => {
            console.log("[VoiceButton] Speech recognition ended");
            // Restart if still recording (browser may auto-stop after silence)
            if (isRecording && recognitionRef.current) {
              try {
                recognition.start();
                console.log("[VoiceButton] Speech recognition restarted");
              } catch (e) {
                // Ignore if already started
              }
            }
          };

          recognition.start();
          console.log(`[VoiceButton] Speech recognition started (${language})`);
        } else {
          console.warn("[VoiceButton] Speech Recognition not supported in this browser");
        }
      }
    } catch (error) {
      console.error("Error accessing microphone:", error);
      setIsRecording(false);
    }
  }, [onRecordingComplete, onTranscript, useBrowserSTT, language, isRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setInterimTranscript("");

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  // Toggle recording on click
  const handleClick = useCallback(() => {
    if (disabled) return;

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [disabled, isRecording, startRecording, stopRecording]);

  const handleLanguageChange = (langCode: string) => {
    setLanguage(langCode);
    setShowLangMenu(false);
    // Notify parent of language change
    onLanguageChange?.(langCode);
    // If currently recording, restart with new language
    if (isRecording) {
      stopRecording();
      setTimeout(() => startRecording(), 100);
    }
  };

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === language);

  return (
    <div className="relative flex items-center gap-1">
      {/* Language selector - Modern minimal design */}
      {showLanguageSelector && (
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-xs font-medium rounded-xl hover:bg-gray-100"
            onClick={() => setShowLangMenu(!showLangMenu)}
            disabled={disabled}
            title={`Language: ${currentLang?.label || "English"}`}
          >
            {currentLang?.flag || "EN"}
          </Button>

          {showLangMenu && (
            <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50 min-w-[140px]">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors",
                    language === lang.code && "bg-emerald-50 text-emerald-700"
                  )}
                  onClick={() => handleLanguageChange(lang.code)}
                >
                  <span className="font-medium w-6 text-gray-500">{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main voice button - Modern design */}
      <Button
        variant={isRecording ? "destructive" : "outline"}
        size="icon"
        className={cn(
          "relative transition-all border-gray-200",
          isRecording
            ? "bg-red-500 hover:bg-red-600 border-red-500 ring-4 ring-red-100"
            : "hover:bg-gray-50 hover:border-gray-300",
          className
        )}
        disabled={disabled}
        onClick={handleClick}
      >
        {/* Microphone Icon */}
        {!isRecording ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        ) : (
          /* Stop Icon when recording */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4"
          >
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-white flex items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          </span>
        )}

        <span className="sr-only">
          {isRecording ? "Click to stop recording" : "Click to start recording"}
        </span>
      </Button>

      {/* Interim transcript indicator - Modern tooltip */}
      {isRecording && interimTranscript && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] shadow-lg">
          {interimTranscript}...
        </div>
      )}
    </div>
  );
}
