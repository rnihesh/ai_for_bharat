"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChatWindow } from "./ChatWindow";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

interface ChatWidgetProps {
  defaultOpen?: boolean;
}

export function ChatWidget({ defaultOpen = false }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const pathname = usePathname();

  // Don't show widget on agent page (it has its own full-screen chat)
  const isAgentPage = pathname === "/agent";

  // Don't show on municipality pages
  const isMunicipalityPage = pathname?.startsWith("/municipality");

  // Don't show on admin pages
  const isAdminPage = pathname?.startsWith("/admin");

  // Reset state when navigating
  useEffect(() => {
    if (isAgentPage || isMunicipalityPage || isAdminPage) {
      setIsOpen(false);
    }
  }, [pathname, isAgentPage, isMunicipalityPage, isAdminPage]);

  if (isAgentPage || isMunicipalityPage || isAdminPage) {
    return null;
  }

  const handleIssueSubmitted = (issueId: string) => {
    // Could show a toast notification or redirect
    console.log("Issue submitted:", issueId);
  };

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-50 transition-all duration-300 ease-out",
            // Mobile: full screen
            "inset-0",
            // Small tablets: slightly padded
            "sm:inset-4",
            // Medium screens: positioned bottom-right, fixed size
            "md:inset-auto md:bottom-24 md:right-6",
            "md:w-[400px] md:h-[550px]",
            // Large screens: larger chat window
            "lg:w-[440px] lg:h-[600px]",
            // Extra large screens
            "xl:w-[480px] xl:h-[650px]"
          )}
        >
          <ChatWindow
            onClose={() => setIsOpen(false)}
            onIssueSubmitted={handleIssueSubmitted}
            isVoiceMode={isVoiceMode}
            className="h-full w-full"
          />
        </div>
      )}

      {/* Floating Action Buttons - Hidden on mobile when chat is open (chat has its own close button) */}
      <div
        className={cn(
          "fixed z-[60] flex flex-col items-end gap-3 bottom-6 right-6",
          // Hide entirely on mobile/tablet when chat is open
          isOpen && "hidden md:flex"
        )}
      >
        {/* Main FAB - Clean emerald design */}
        <Button
          size="lg"
          className={cn(
            "h-14 w-14 md:h-16 md:w-16 rounded-2xl shadow-lg transition-all duration-200",
            "bg-emerald-600 hover:bg-emerald-700",
            "hover:scale-105 hover:shadow-xl active:scale-95"
          )}
          onClick={() => {
            setIsOpen(!isOpen);
            setHasNewMessage(false);
          }}
        >
          {isOpen ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 md:h-7 md:w-7"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
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
              className="h-6 w-6 md:h-7 md:w-7"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}

          {/* Notification dot */}
          {hasNewMessage && !isOpen && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-5 w-5 rounded-full bg-emerald-500 items-center justify-center text-[10px] font-bold text-white">
                1
              </span>
            </span>
          )}
        </Button>

        {/* Label (only when closed on desktop) */}
        {!isOpen && (
          <div className="absolute right-20 bottom-3 whitespace-nowrap bg-emerald-600 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden lg:block">
            Report an Issue
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full border-8 border-transparent border-l-emerald-600" />
          </div>
        )}
      </div>
    </>
  );
}
