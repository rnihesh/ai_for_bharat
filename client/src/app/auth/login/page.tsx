"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { MapPin, ArrowLeft, Building2, Mail, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

// Helper function to redirect based on role
const getRedirectPath = (role?: string) => {
  if (role === "PLATFORM_MAINTAINER" || role === "admin") {
    return "/admin/dashboard";
  }
  if (role === "MUNICIPALITY_USER") {
    return "/municipality/issues";
  }
  return "/"; // Users go back to home
};

export default function LoginPage() {
  const router = useRouter();
  const {
    signIn,
    user,
    userProfile,
    loading: authLoading,
    profileLoading,
  } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // Redirect if already logged in - wait for profile to load before redirecting
  useEffect(() => {
    if (user && !authLoading && !profileLoading && userProfile) {
      const redirectPath = getRedirectPath(userProfile.role ?? undefined);
      console.log("Already logged in, redirecting to:", redirectPath);
      router.replace(redirectPath);
    }
  }, [user, authLoading, profileLoading, userProfile, router]);

  // Show loading while checking auth or loading profile or redirecting
  if (authLoading || profileLoading || (user && userProfile)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const profile = await signIn(formData.email, formData.password);
      toast.success("Login successful!", {
        description: "Welcome back!",
      });
      // Redirect immediately using the returned profile
      const redirectPath = getRedirectPath(profile?.role ?? undefined);
      console.log("Login successful, redirecting to:", redirectPath, "Role:", profile?.role);
      router.replace(redirectPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      toast.error("Login failed", {
        description: message,
      });
      setIsLoading(false);
    }
    // Don't set isLoading to false on success - keep showing loader while redirecting
  };

  const handleGoogleSuccess = (profile: { role?: string } | null) => {
    toast.success("Login successful!", {
      description: "Welcome back!",
    });
    // Redirect immediately using the returned profile
    const redirectPath = getRedirectPath(profile?.role ?? undefined);
    console.log("Google login successful, redirecting to:", redirectPath, "Role:", profile?.role);
    router.replace(redirectPath);
  };

  const handleGoogleError = (error: string) => {
    toast.error("Google sign-in failed", {
      description: error,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            {/* <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MapPin className="h-5 w-5" />
            </div> */}
            <span className="font-bold text-xl">CivicLemma</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      {/* Login Form */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to access your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Google Sign In */}
            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
            />

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Sign In with Email
                  </>
                )}
              </Button>
            </form>

            {/* Help text for municipality users */}
            <div className="text-center text-sm text-muted-foreground">
              <p>Municipality accounts are provided by the platform.</p>
              <p>Contact support if you need assistance.</p>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 text-center text-sm text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} CivicLemma. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
