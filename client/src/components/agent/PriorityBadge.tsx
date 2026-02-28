"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface PriorityBadgeProps {
  score: number;
  severity: Severity;
  reasoning?: string;
  showScore?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const severityConfig: Record<
  Severity,
  { bg: string; text: string; border: string; label: string }
> = {
  CRITICAL: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    label: "Critical",
  },
  HIGH: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
    label: "High",
  },
  MEDIUM: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-400",
    border: "border-yellow-200 dark:border-yellow-800",
    label: "Medium",
  },
  LOW: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
    label: "Low",
  },
};

const sizeConfig = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2 py-1",
  lg: "text-base px-3 py-1.5",
};

export function PriorityBadge({
  score,
  severity,
  reasoning,
  showScore = true,
  size = "md",
  className,
}: PriorityBadgeProps) {
  const config = severityConfig[severity];

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        config.bg,
        config.text,
        config.border,
        sizeConfig[size],
        className
      )}
    >
      {/* Severity indicator dot */}
      <span
        className={cn("h-2 w-2 rounded-full", {
          "bg-red-500": severity === "CRITICAL",
          "bg-orange-500": severity === "HIGH",
          "bg-yellow-500": severity === "MEDIUM",
          "bg-green-500": severity === "LOW",
        })}
      />

      {/* Label */}
      <span>{config.label}</span>

      {/* Score */}
      {showScore && (
        <span className="opacity-75">
          ({score}/10)
        </span>
      )}
    </span>
  );

  if (reasoning) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-sm">{reasoning}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

interface PriorityScoreBarProps {
  score: number;
  className?: string;
}

export function PriorityScoreBar({ score, className }: PriorityScoreBarProps) {
  const percentage = (score / 10) * 100;

  const getColor = (score: number) => {
    if (score >= 9) return "bg-red-500";
    if (score >= 7) return "bg-orange-500";
    if (score >= 4) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Priority</span>
        <span>{score}/10</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", getColor(score))}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
