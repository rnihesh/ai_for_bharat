"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, MapPin, LogOut, RefreshCw, Loader2 } from "lucide-react";

export default function PendingApprovalPage() {
  const { user, userProfile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/auth/login");
        return;
      }

      // If user is approved municipality, redirect to issues
      if (userProfile?.role === "MUNICIPALITY_USER") {
        router.push("/municipality/issues");
        return;
      }

      // If user is admin, redirect to admin dashboard
      if (userProfile?.role === "PLATFORM_MAINTAINER") {
        router.push("/admin/dashboard");
        return;
      }

      // If user is just a citizen (registration not submitted), stay here
    }
  }, [user, userProfile, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MapPin className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl">CivicLemma</span>
          </Link>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className="text-2xl">
              Registration Pending Approval
            </CardTitle>
            <CardDescription className="text-base">
              Your municipality registration has been submitted and is awaiting
              admin approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-lg text-left space-y-2">
              <p className="text-sm font-medium">What happens next?</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• An admin will review your registration</li>
                <li>• This typically takes 1-3 business days</li>
                <li>• You'll receive an email once approved</li>
                <li>
                  • After approval, you can access the Municipality Dashboard
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Status
              </Button>
              <Button asChild className="w-full">
                <Link href="/">Return to Homepage</Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Have questions? Contact support at support@civiclemma.in
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
