"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description:
            "group-[.toast]:!text-slate-700 dark:group-[.toast]:!text-slate-300",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:border-green-500/50 group-[.toaster]:bg-green-50 dark:group-[.toaster]:bg-green-950/30 [&_[data-description]]:!text-green-700 dark:[&_[data-description]]:!text-green-300",
          error:
            "group-[.toaster]:border-red-500/50 group-[.toaster]:bg-red-50 dark:group-[.toaster]:bg-red-950/30 [&_[data-description]]:!text-red-700 dark:[&_[data-description]]:!text-red-300",
          warning:
            "group-[.toaster]:border-yellow-500/50 group-[.toaster]:bg-yellow-50 dark:group-[.toaster]:bg-yellow-950/30 [&_[data-description]]:!text-yellow-700 dark:[&_[data-description]]:!text-yellow-300",
          info: "group-[.toaster]:border-blue-500/50 group-[.toaster]:bg-blue-50 dark:group-[.toaster]:bg-blue-950/30 [&_[data-description]]:!text-blue-700 dark:[&_[data-description]]:!text-blue-300",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
