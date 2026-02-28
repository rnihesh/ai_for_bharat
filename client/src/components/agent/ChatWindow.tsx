"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "./ChatMessage";
import { VoiceButton } from "./VoiceButton";
import { ImageCapture } from "./ImageCapture";
import { agentApi, ChatMessageResponse } from "@/lib/agentApi";
import { uploadImage } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  timestamp: Date;
}

interface ChatWindowProps {
  onClose?: () => void;
  onIssueSubmitted?: (issueId: string) => void;
  isVoiceMode?: boolean;
  className?: string;
}

export function ChatWindow({
  onClose,
  onIssueSubmitted,
  isVoiceMode = false,
  className,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [agentConfig, setAgentConfig] = useState<{
    whisper_enabled: boolean;
    tts_enabled: boolean;
  } | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState("en-IN");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        // Get config first
        const config = await agentApi.config();
        setAgentConfig(config);

        // Start session
        const response = await agentApi.chat.start({
          is_voice: isVoiceMode,
          user_agent: navigator.userAgent,
        });

        setSessionId(response.session_id);
        addMessage("assistant", response.message);
        setConnectionError(false);
      } catch (error) {
        console.error("Failed to start session:", error);
        setConnectionError(true);
        addMessage(
          "assistant",
          "I apologize, but I am having trouble connecting to the server. Please try again in a moment, or use the standard reporting form."
        );
      }
    };

    initSession();

    return () => {
      // End session on unmount
      if (sessionId) {
        agentApi.chat.end(sessionId).catch(console.error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoiceMode]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (role: "user" | "assistant", content: string, imageUrl?: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        role,
        content,
        imageUrl,
        timestamp: new Date(),
      },
    ]);
  };

  const uploadImageToCloud = async (file: File): Promise<string | null> => {
    // Upload to Cloudinary for a proper URL
    try {
      const result = await uploadImage(file);
      if (result.success && result.url) {
        return result.url;
      }
      console.error("Cloudinary upload failed:", result.error);
      return null;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const sendMessage = async (text: string, imageUrl?: string): Promise<string | null> => {
    if (!sessionId || (!text.trim() && !imageUrl)) return null;

    setIsLoading(true);

    // Add user message
    addMessage("user", text || "Shared an image", imageUrl);

    try {
      // Check if we should include location
      let location: { lat: number; lng: number } | undefined;

      // Request location if message suggests it or we haven't asked yet
      const shouldRequestLocation =
        !locationRequested &&
        (text.toLowerCase().includes("location") ||
          text.toLowerCase().includes("here") ||
          text.toLowerCase().includes("my area"));

      if (shouldRequestLocation) {
        const loc = await getCurrentLocation();
        if (loc) {
          location = loc;
          setLocationRequested(true);
        }
      }

      const response: ChatMessageResponse = await agentApi.chat.message({
        session_id: sessionId,
        message: text,
        image_url: imageUrl,
        location,
      });

      addMessage("assistant", response.message);

      // Check if issue was submitted
      if (response.issue_id) {
        onIssueSubmitted?.(response.issue_id);
      }

      // If location is missing and we haven't requested it, ask for it
      if (
        response.missing_fields.includes("location") &&
        !locationRequested
      ) {
        const loc = await getCurrentLocation();
        if (loc) {
          setLocationRequested(true);
          // Automatically send location
          await agentApi.chat.message({
            session_id: sessionId,
            message: "Here is my location",
            location: loc,
          });
        }
      }

      return response.message;
    } catch (error) {
      console.error("Failed to send message:", error);
      addMessage(
        "assistant",
        "I apologize, something went wrong. Please try again."
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let imageUrl: string | undefined;

    // Upload pending image to Cloudinary
    if (pendingImage) {
      setIsLoading(true);
      const url = await uploadImageToCloud(pendingImage);
      if (url) {
        imageUrl = url;
      } else {
        addMessage(
          "assistant",
          "I had trouble uploading your image. Please try again."
        );
        setIsLoading(false);
        return;
      }
      setPendingImage(null);
      setPendingImageUrl(null);
    }

    await sendMessage(inputValue, imageUrl);
    setInputValue("");
    inputRef.current?.focus();
  };

  const handleImageCapture = (file: File) => {
    setPendingImage(file);
    const url = URL.createObjectURL(file);
    setPendingImageUrl(url);
  };

  const handleVoiceTranscript = async (transcript: string) => {
    if (!sessionId || !transcript.trim()) return;

    // Send the transcript as a regular text message
    const responseMessage = await sendMessage(transcript);

    // Speak the AI response using browser TTS
    if (responseMessage) {
      speakText(responseMessage);
    }
  };

  const handleVoiceRecording = async (audioBlob: Blob) => {
    // This is called when recording stops, but we use browser STT via onTranscript
    // The audioBlob is not needed when using browser STT
    console.log("Voice recording completed, size:", audioBlob.size);
  };

  const speakText = useCallback((text: string) => {
    try {
      if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        // Use the selected voice language for TTS
        utterance.lang = voiceLanguage;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Try to find a voice for the selected language
        const voices = window.speechSynthesis.getVoices();
        const matchingVoice = voices.find(v => v.lang.startsWith(voiceLanguage.split('-')[0]));
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }

        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.error("TTS playback error:", e);
    }
  }, [voiceLanguage]);

  const handleLocationShare = async () => {
    const location = await getCurrentLocation();
    if (location && sessionId) {
      setLocationRequested(true);
      setIsLoading(true);

      // Add user message
      addMessage("user", `Sharing my location`);

      try {
        // Send message with actual location coordinates
        const response: ChatMessageResponse = await agentApi.chat.message({
          session_id: sessionId,
          message: "Here is my current location",
          location: location,
        });

        addMessage("assistant", response.message);

        // Check if issue was submitted
        if (response.issue_id) {
          onIssueSubmitted?.(response.issue_id);
        }
      } catch (error) {
        console.error("Failed to send location:", error);
        addMessage(
          "assistant",
          "I had trouble processing your location. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    } else {
      addMessage(
        "assistant",
        "I could not access your location. Please make sure location access is enabled in your browser settings."
      );
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-white rounded-none sm:rounded-2xl border-0 sm:border border-gray-200 shadow-none sm:shadow-2xl overflow-hidden",
        className
      )}
    >
      {/* Header - Clean minimal */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Report Issue</h3>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                connectionError ? "bg-amber-500" : "bg-emerald-500"
              )} />
              <span>{connectionError ? "Reconnecting..." : "Online"}</span>
            </div>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
        <div className="py-4 px-3">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7 text-emerald-600"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h4 className="text-base font-semibold text-gray-900 mb-1">
                Report a Civic Issue
              </h4>
              <p className="text-sm text-gray-500 max-w-[260px]">
                Describe the problem and share a photo. I'll help you submit it to your municipality.
              </p>
            </div>
          )}
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              imageUrl={message.imageUrl}
              timestamp={message.timestamp}
            />
          ))}
          {isLoading && (
            <ChatMessage role="assistant" content="" isLoading />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pending image preview */}
      {pendingImageUrl && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <img
                src={pendingImageUrl}
                alt="Pending upload"
                className="h-14 w-14 rounded-lg object-cover border border-gray-200"
              />
              <button
                className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-700"
                onClick={() => {
                  setPendingImage(null);
                  if (pendingImageUrl) {
                    URL.revokeObjectURL(pendingImageUrl);
                    setPendingImageUrl(null);
                  }
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Image attached</p>
              <p className="text-xs text-gray-500">Ready to send</p>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-100 bg-white p-3 shrink-0">
        {/* Action buttons */}
        <div className="flex items-center gap-2 mb-3">
          <ImageCapture
            onImageCapture={handleImageCapture}
            disabled={isLoading}
            showPreview={false}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleLocationShare}
            disabled={isLoading || locationRequested}
            title={locationRequested ? "Location shared" : "Share location"}
            className={cn(
              "h-9 w-9 text-gray-500 hover:text-gray-700 hover:bg-gray-100",
              locationRequested && "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700"
            )}
          >
            {locationRequested ? (
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
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
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
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            )}
          </Button>
          <VoiceButton
            onRecordingComplete={handleVoiceRecording}
            onTranscript={handleVoiceTranscript}
            disabled={isLoading}
            useBrowserSTT={true}
            language={voiceLanguage}
            onLanguageChange={setVoiceLanguage}
            className="h-9 w-9"
          />
        </div>

        {/* Message input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Describe the issue..."
            disabled={isLoading}
            className="flex-1 h-10 text-sm border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || (!inputValue.trim() && !pendingImage)}
            className="h-10 w-10 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
          >
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
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </Button>
        </form>
      </div>
    </div>
  );
}
