"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  timestamp?: Date;
  isLoading?: boolean;
}

export function ChatMessage({
  role,
  content,
  imageUrl,
  timestamp,
  isLoading,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex w-full gap-3 py-2 px-2",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm",
          isUser
            ? "bg-gray-900 text-white"
            : "bg-emerald-600 text-white"
        )}
      >
        {isUser ? (
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
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1.5",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Image if present */}
        {imageUrl && (
          <div className="relative h-40 w-40 overflow-hidden rounded-lg border border-gray-200">
            <Image
              src={imageUrl}
              alt="Uploaded image"
              fill
              className="object-cover"
              sizes="160px"
            />
          </div>
        )}

        {/* Text bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-gray-900 text-white rounded-br-md"
              : "bg-white border border-gray-200 text-gray-700 rounded-bl-md"
          )}
        >
          {isLoading ? (
            <div className="flex items-center gap-1 py-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{content}</p>
          )}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <span className="text-[10px] text-gray-400 px-1">
            {timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
