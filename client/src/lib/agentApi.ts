/**
 * Agent API Client
 * Client for the AI Agent Service
 */

const AGENT_BASE_URL =
  process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:8001";

// ============================================
// Types
// ============================================

export interface AgentHealthResponse {
  status: string;
  timestamp: string;
  services: {
    bedrock: boolean;
    polly_tts: boolean;
    transcribe_stt: boolean;
    weather: boolean;
    dynamodb: boolean;
  };
}

export interface AgentConfigResponse {
  whisper_enabled: boolean;
  tts_enabled: boolean;
  weather_enabled: boolean;
}

export interface StartSessionResponse {
  session_id: string;
  message: string;
  state: string;
}

export interface ChatMessageResponse {
  session_id: string;
  message: string;
  state: string;
  collected_data: Record<string, unknown>;
  is_complete: boolean;
  missing_fields: string[];
  issue_id?: string;
}

export interface EndSessionResponse {
  session_id: string;
  message: string;
  issue_id?: string;
}

export interface VoiceAudioResponse {
  session_id: string;
  transcription: string;
  confidence?: number;
  response_text: string;
  response_audio_url?: string;
  state: string;
  collected_data: Record<string, unknown>;
  is_complete: boolean;
  error?: string;
  use_browser_stt?: boolean;
}

export interface PriorityScore {
  issue_id?: string;
  score: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  reasoning: string;
  recommended_action: string;
  estimated_response_time: string;
  factors: {
    image_severity_score: number;
    image_severity_reasoning: string;
    location_context_score: number;
    location_context_reasoning: string;
    near_sensitive_location: boolean;
    is_main_road: boolean;
    historical_score: number;
    historical_reasoning: string;
    repeat_issue_count: number;
    is_hotspot: boolean;
    temporal_score: number;
    temporal_reasoning: string;
    workload_score: number;
    workload_reasoning: string;
  };
  scored_at: string;
}

export interface BatchPriorityResponse {
  scores: PriorityScore[];
  total_processed: number;
  errors: string[];
}

// ============================================
// API Functions
// ============================================

async function agentFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${AGENT_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Agent API error: ${error}`);
  }

  return response.json();
}

// Health & Config
export const agentApi = {
  /**
   * Check agent service health
   */
  health: () => agentFetch<AgentHealthResponse>("/agent/health"),

  /**
   * Get agent configuration (available features)
   */
  config: () => agentFetch<AgentConfigResponse>("/agent/config"),

  // ============================================
  // Chat Agent
  // ============================================

  chat: {
    /**
     * Start a new chat session
     */
    start: (options?: { is_voice?: boolean; user_agent?: string }) =>
      agentFetch<StartSessionResponse>("/agent/chat/start", {
        method: "POST",
        body: JSON.stringify(options || {}),
      }),

    /**
     * Send a message in an existing session
     */
    message: (params: {
      session_id: string;
      message: string;
      image_url?: string;
      location?: { lat: number; lng: number };
    }) =>
      agentFetch<ChatMessageResponse>("/agent/chat/message", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    /**
     * End a chat session
     */
    end: (session_id: string) =>
      agentFetch<EndSessionResponse>("/agent/chat/end", {
        method: "POST",
        body: JSON.stringify({ session_id }),
      }),
  },

  // ============================================
  // Voice Agent
  // ============================================

  voice: {
    /**
     * Start a new voice session
     */
    start: (options?: { user_agent?: string }) =>
      agentFetch<StartSessionResponse>("/agent/voice/start", {
        method: "POST",
        body: JSON.stringify({ is_voice: true, ...options }),
      }),

    /**
     * Send audio for processing
     */
    audio: async (session_id: string, audioBlob: Blob): Promise<VoiceAudioResponse> => {
      const formData = new FormData();
      formData.append("session_id", session_id);
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch(`${AGENT_BASE_URL}/agent/voice/audio`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Voice API error: ${error}`);
      }

      return response.json();
    },

    /**
     * Get TTS audio for text
     */
    tts: async (text: string, voice?: string): Promise<Blob> => {
      const response = await fetch(`${AGENT_BASE_URL}/agent/voice/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });

      if (!response.ok) {
        throw new Error("TTS request failed");
      }

      return response.blob();
    },
  },

  // ============================================
  // Priority Agent
  // ============================================

  priority: {
    /**
     * Score a single issue
     */
    score: (params: {
      issue_id: string;
      image_url?: string;
      description?: string;
      location?: { lat: number; lng: number };
      issue_type?: string;
    }) =>
      agentFetch<PriorityScore>("/agent/priority/score", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    /**
     * Score multiple issues in batch
     */
    batch: (issue_ids: string[]) =>
      agentFetch<BatchPriorityResponse>("/agent/priority/batch", {
        method: "POST",
        body: JSON.stringify({ issue_ids }),
      }),
  },
};

export default agentApi;
