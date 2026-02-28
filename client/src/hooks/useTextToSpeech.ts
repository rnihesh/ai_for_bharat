"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { agentApi } from "@/lib/agentApi";

interface UseTextToSpeechOptions {
  useServerTTS?: boolean;
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

interface UseTextToSpeechReturn {
  isSpeaking: boolean;
  isLoading: boolean;
  isSupported: boolean;
  error: string | null;
  speak: (text: string) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

/**
 * Hook for text-to-speech functionality
 * Supports both server-side TTS (Amazon Polly) and browser Web Speech API
 */
export function useTextToSpeech(
  options: UseTextToSpeechOptions = {}
): UseTextToSpeechReturn {
  const {
    useServerTTS = false,
    voice,
    rate = 1,
    pitch = 1,
    volume = 1,
    onStart,
    onEnd,
    onError,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check for browser support
  useEffect(() => {
    setIsSupported("speechSynthesis" in window || useServerTTS);
  }, [useServerTTS]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (utteranceRef.current) {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  const speakWithServer = useCallback(
    async (text: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const audioBlob = await agentApi.voice.tts(text, voice);
        const audioUrl = URL.createObjectURL(audioBlob);

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsSpeaking(true);
          setIsLoading(false);
          onStart?.();
        };

        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          onEnd?.();
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          setIsLoading(false);
          setError("Failed to play audio");
          URL.revokeObjectURL(audioUrl);
          onError?.("Failed to play audio");
        };

        await audio.play();
      } catch (e) {
        setIsLoading(false);
        const errorMsg = e instanceof Error ? e.message : "TTS failed";
        setError(errorMsg);
        onError?.(errorMsg);
      }
    },
    [voice, onStart, onEnd, onError]
  );

  const speakWithBrowser = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) {
        setError("Browser TTS not supported");
        onError?.("Browser TTS not supported");
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      // Set options
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      // Try to find a good voice
      const voices = window.speechSynthesis.getVoices();
      const indianVoice = voices.find(
        (v) => v.lang.includes("en-IN") || v.lang.includes("en-GB")
      );
      if (indianVoice) {
        utterance.voice = indianVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        onStart?.();
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        onEnd?.();
      };

      utterance.onerror = (event) => {
        setIsSpeaking(false);
        const errorMsg = `Speech error: ${event.error}`;
        setError(errorMsg);
        onError?.(errorMsg);
      };

      window.speechSynthesis.speak(utterance);
    },
    [rate, pitch, volume, onStart, onEnd, onError]
  );

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      setError(null);

      if (useServerTTS) {
        await speakWithServer(text);
      } else {
        speakWithBrowser(text);
      }
    },
    [useServerTTS, speakWithServer, speakWithBrowser]
  );

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.resume();
    }
  }, []);

  return {
    isSpeaking,
    isLoading,
    isSupported,
    error,
    speak,
    stop,
    pause,
    resume,
  };
}
