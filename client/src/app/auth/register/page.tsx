"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  MapPin,
  ArrowLeft,
  Building2,
  UserPlus,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { municipalitiesApi } from "@/lib/api";
import { auth } from "@/lib/firebase";

const indianStates = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp, user, loading: authLoading, profileLoading, userProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isMunicipalityRegistration =
    searchParams.get("type") === "municipality";
  const totalSteps = isMunicipalityRegistration ? 3 : 1;

  const [formData, setFormData] = useState({
    // Account Details
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    // Municipality Details
    municipalityName: "",
    state: "",
    district: "",
    population: "",
    contactPhone: "",
    address: "",
    // Verification
    registrationNumber: "",
    documents: null as File | null,
  });

  // Handle redirects and step management for logged-in users
  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (user && userProfile) {
      if (isMunicipalityRegistration) {
        // User is logged in and wants to register municipality - skip to step 2
        if (step === 1) {
          setStep(2);
          // Populate form with user's data
          setFormData((prev) => ({
            ...prev,
            name: user.displayName || prev.name,
            email: user.email || prev.email,
          }));
        }
      } else {
        // Regular registration but already logged in - redirect based on role
        if (userProfile.role === "PLATFORM_MAINTAINER") {
          router.push("/admin/dashboard");
        } else if (userProfile.role === "MUNICIPALITY_USER") {
          router.push("/municipality/issues");
        } else {
          router.push("/");
        }
      }
    }
  }, [user, userProfile, authLoading, profileLoading, router, isMunicipalityRegistration, step]);

  const handleGoogleSuccess = (profile: { role?: string } | null) => {
    toast.success("Account created!", {
      description: "Welcome to CivicLemma!",
    });

    if (isMunicipalityRegistration) {
      // For municipality registration, they need to complete the form
      setStep(2);
    } else {
      // Regular users go to home, special roles go to their dashboards
      if (profile?.role === "PLATFORM_MAINTAINER") {
        router.push("/admin/dashboard");
      } else if (profile?.role === "MUNICIPALITY_USER") {
        router.push("/municipality/issues");
      } else {
        router.push("/");
      }
    }
  };

  const handleGoogleError = (error: string) => {
    toast.error("Google sign-in failed", {
      description: error,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For user registration (single step)
    if (!isMunicipalityRegistration) {
      if (formData.password !== formData.confirmPassword) {
        toast.error("Passwords don't match");
        return;
      }
      if (formData.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }

      setIsLoading(true);
      try {
        await signUp(formData.email, formData.password, formData.name);
        toast.success("Account created!", {
          description: "Please check your email to verify your account.",
        });
        router.push("/");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Registration failed";
        toast.error("Registration failed", { description: message });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Municipality registration multi-step
    if (step === 1) {
      if (formData.password !== formData.confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (formData.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }

      // Create the account first
      setIsLoading(true);
      try {
        await signUp(formData.email, formData.password, formData.name);
        toast.success("Account created!", {
          description: "Now let's add your municipality details.",
        });
        setStep(2);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Registration failed";
        toast.error("Registration failed", { description: message });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }

    // Final step - submit municipality registration
    setIsLoading(true);

    try {
      // Get the current user's auth token
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast.error("Session expired. Please sign in again.");
        router.push("/auth/login");
        return;
      }

      // Submit municipality registration to API
      const result = await municipalitiesApi.submitRegistration(
        {
          // User details
          name: formData.name,
          email: formData.email,
          phone: formData.contactPhone,
          // Municipality details
          municipalityName: formData.municipalityName,
          municipalityType: "MUNICIPALITY", // Default type
          state: formData.state,
          district: formData.district,
          address: formData.address,
          population: formData.population
            ? parseInt(formData.population, 10)
            : undefined,
          // Verification
          registrationNumber: formData.registrationNumber,
        },
        token
      );

      if (result.success) {
        toast.success("Registration submitted!", {
          description:
            "Your application will be reviewed within 3-5 business days.",
        });
        router.push("/municipality/pending");
      } else {
        toast.error("Registration failed", {
          description: result.error || "Please try again later.",
        });
      }
    } catch {
      toast.error("Registration failed", {
        description: "Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      {/* Registration Form */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              {isMunicipalityRegistration ? (
                <Building2 className="h-6 w-6 text-primary" />
              ) : (
                <UserPlus className="h-6 w-6 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {isMunicipalityRegistration
                ? "Register Municipality"
                : "Create Account"}
            </CardTitle>
            <CardDescription>
              {isMunicipalityRegistration
                ? `Step ${step} of ${totalSteps}: ${
                    step === 1
                      ? "Account Details"
                      : step === 2
                      ? "Municipality Information"
                      : "Verification"
                  }`
                : "Join Nagarik Seva to report civic issues"}
            </CardDescription>

            {/* Progress - only for municipality registration */}
            {isMunicipalityRegistration && (
              <div className="flex gap-2 mt-4">
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map(
                  (s) => (
                    <div
                      key={s}
                      className={`flex-1 h-2 rounded-full ${
                        s <= step ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Google Sign In - only on step 1 */}
            {step === 1 && (
              <>
                <GoogleSignInButton
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                />

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or register with email
                    </span>
                  </div>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      required
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">
                      {isMunicipalityRegistration
                        ? "Official Email *"
                        : "Email *"}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={
                        isMunicipalityRegistration
                          ? "contact@municipality.gov.in"
                          : "you@example.com"
                      }
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      required
                      autoComplete="email"
                    />
                    {isMunicipalityRegistration && (
                      <p className="text-xs text-muted-foreground">
                        Use your official government email address
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                        required
                        minLength={6}
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Must be at least 6 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                        required
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="municipalityName">
                      Municipality Name *
                    </Label>
                    <Input
                      id="municipalityName"
                      placeholder="e.g., Municipal Corporation of Delhi"
                      value={formData.municipalityName}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          municipalityName: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="state">State *</Label>
                      <Select
                        value={formData.state}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, state: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {indianStates.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="district">District *</Label>
                      <Input
                        id="district"
                        placeholder="Enter district"
                        value={formData.district}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            district: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="population">Population (approx)</Label>
                      <Input
                        id="population"
                        type="number"
                        placeholder="e.g., 500000"
                        value={formData.population}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            population: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactPhone">Contact Phone *</Label>
                      <Input
                        id="contactPhone"
                        type="tel"
                        placeholder="+91 XXXXX XXXXX"
                        value={formData.contactPhone}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            contactPhone: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Office Address *</Label>
                    <Textarea
                      id="address"
                      placeholder="Full address of the municipality office"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                      rows={3}
                      required
                    />
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">
                      Registration Number *
                    </Label>
                    <Input
                      id="registrationNumber"
                      placeholder="Government registration/license number"
                      value={formData.registrationNumber}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          registrationNumber: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Verification Documents *</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Upload official registration documents
                      </p>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        id="documents"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setFormData((prev) => ({ ...prev, documents: file }));
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          document.getElementById("documents")?.click()
                        }
                      >
                        Choose File
                      </Button>
                      {formData.documents && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Selected: {formData.documents.name}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Accepted formats: PDF, JPG, PNG (max 10MB)
                    </p>
                  </div>

                  <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                      Verification Process
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Your registration will be reviewed by our team within 3-5
                      business days. You will receive an email once your account
                      is verified.
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(step - 1)}
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                )}
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isMunicipalityRegistration && step === totalSteps
                        ? "Submitting..."
                        : "Creating account..."}
                    </>
                  ) : isMunicipalityRegistration && step === totalSteps ? (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Submit Registration
                    </>
                  ) : isMunicipalityRegistration ? (
                    "Continue"
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Create Account
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Terms */}
            <p className="text-xs text-center text-muted-foreground">
              By creating an account, you agree to our{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </p>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">
                Already have an account?{" "}
              </span>
              <Link
                href="/auth/login"
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </Link>
            </div>

            {/* Switch registration type */}
            {step === 1 && (
              <div className="pt-4 border-t text-center text-sm">
                {isMunicipalityRegistration ? (
                  <>
                    <span className="text-muted-foreground">
                      Not a municipality?{" "}
                    </span>
                    <Link
                      href="/auth/register"
                      className="text-primary hover:underline font-medium"
                    >
                      Register as user
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      Are you a municipality official?{" "}
                    </span>
                    <Link
                      href="/auth/register?type=municipality"
                      className="text-primary hover:underline font-medium"
                    >
                      Register municipality
                    </Link>
                  </>
                )}
              </div>
            )}
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

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
