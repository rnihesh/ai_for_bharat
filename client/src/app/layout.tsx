import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatWidget } from "@/components/agent/ChatWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CivicLemma - Civic Issue Reporting Platform",
  description:
    "Report civic issues anonymously and hold your municipality accountable. A transparent platform for people to report potholes, garbage, drainage problems and more.",
  keywords: [
    "civic",
    "municipality",
    "governance",
    "india",
    "transparency",
    "potholes",
    "garbage",
    "drainage",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
        <ChatWidget />
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
