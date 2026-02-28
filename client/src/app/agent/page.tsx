"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChatWindow } from "@/components/agent/ChatWindow";
import { agentApi, AgentConfigResponse } from "@/lib/agentApi";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AgentPage() {
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [agentConfig, setAgentConfig] = useState<AgentConfigResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [submittedIssueId, setSubmittedIssueId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const health = await agentApi.health();
        setIsConnected(health.status === "ok");

        const config = await agentApi.config();
        setAgentConfig(config);
      } catch (error) {
        console.error("Agent service not available:", error);
        setIsConnected(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkConnection();
  }, []);

  const handleIssueSubmitted = (issueId: string) => {
    setSubmittedIssueId(issueId);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Connecting to AI Assistant...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-semibold">Agent Service Unavailable</h2>
            <p className="mb-6 text-muted-foreground">
              The AI Assistant is currently offline. You can still report issues
              using the standard form.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link href="/report">Report Issue Manually</Link>
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submittedIssueId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-8 w-8"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-semibold">Issue Reported Successfully</h2>
            <p className="mb-4 text-muted-foreground">
              Your issue has been submitted and the relevant municipality has been
              notified.
            </p>
            <p className="mb-6 rounded-lg bg-muted px-4 py-2 font-mono text-sm">
              Reference: {submittedIssueId}
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setSubmittedIssueId(null)}>
                Report Another Issue
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold">CivicLemma</span>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">AI Assistant</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 rounded-lg border p-1">
              <Button
                variant={!isVoiceMode ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsVoiceMode(false)}
                className="gap-1"
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
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="hidden sm:inline">Chat</span>
              </Button>
              <Button
                variant={isVoiceMode ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsVoiceMode(true)}
                disabled={!agentConfig?.tts_enabled && !agentConfig?.whisper_enabled}
                className="gap-1"
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
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
                <span className="hidden sm:inline">Voice</span>
              </Button>
            </div>

            <Button variant="outline" size="sm" asChild>
              <Link href="/report">Standard Form</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container flex flex-1 flex-col py-4 md:py-6">
        <div className="mx-auto w-full max-w-2xl flex-1">
          {/* Info Banner */}
          <div className="mb-4 rounded-lg border bg-muted/50 p-3 text-sm">
            <p className="text-muted-foreground">
              {isVoiceMode ? (
                <>
                  <strong>Voice Mode:</strong> Hold the microphone button to speak.
                  Release to send your message.
                </>
              ) : (
                <>
                  <strong>Chat Mode:</strong> Describe your issue, upload a photo,
                  and share your location. I will help you submit your report.
                </>
              )}
            </p>
          </div>

          {/* Chat Window */}
          <div className="flex-1 rounded-lg border shadow-sm" style={{ height: "calc(100vh - 220px)" }}>
            <ChatWindow
              isVoiceMode={isVoiceMode}
              onIssueSubmitted={handleIssueSubmitted}
              className="h-full border-0 shadow-none"
            />
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="border-t py-4">
        <div className="container">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>Powered by AI</span>
            <span>|</span>
            <span>Anonymous Reporting</span>
            <span>|</span>
            <span>Available 24/7</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
