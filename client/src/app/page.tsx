"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { issuesApi } from "@/lib/api";

interface Stats {
  totalIssues: number;
  resolvedIssues: number;
  totalMunicipalities: number;
  avgResponseTime: number;
}

export default function HomePage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, profileLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  // Redirect municipality/admin users to their dashboards
  useEffect(() => {
    if (!authLoading && !profileLoading && user && userProfile) {
      console.log("Home page - User role:", userProfile.role);
      if (userProfile.role === "PLATFORM_MAINTAINER" || userProfile.role === "admin") {
        console.log("Redirecting admin to dashboard...");
        router.replace("/admin/dashboard");
        return;
      }
      if (userProfile.role === "MUNICIPALITY_USER") {
        console.log("Redirecting municipality to issues...");
        router.replace("/municipality/issues");
        return;
      }
    }
  }, [authLoading, profileLoading, user, userProfile, router]);

  // Fetch stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const result = await issuesApi.getStats();
        if (result.success && result.data) {
          setStats(result.data);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };
    fetchStats();
  }, []);

  // Show loading while checking auth for redirects
  const shouldRedirect =
    user &&
    userProfile &&
    (userProfile.role === "PLATFORM_MAINTAINER" ||
      userProfile.role === "admin" ||
      userProfile.role === "MUNICIPALITY_USER");
  const isCheckingAuth =
    authLoading || profileLoading || (user && !userProfile);

  if (isCheckingAuth || shouldRedirect) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section - Clean & Minimal */}
        <section className="py-20 md:py-32">
          <div className="container px-4">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white">
                Report Civic Issues.
                <br />
                <span className="text-emerald-600">
                  Make Your City Better.
                </span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                Report potholes, garbage, and infrastructure problems.
                Track resolution progress. Hold municipalities accountable.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                {(!user || userProfile?.role === "USER") && (
                  <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8" asChild>
                    <Link href="/report">
                      Report an Issue
                    </Link>
                  </Button>
                )}
                <Button size="lg" variant="outline" className="border-gray-300 hover:bg-gray-50 px-8" asChild>
                  <Link href="/map">
                    View Issue Map
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section - Clean cards */}
        <section className="py-16 bg-gray-50 dark:bg-gray-900/50">
          <div className="container px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm">
                <div className="text-3xl md:text-4xl font-bold text-emerald-600">
                  {stats?.totalIssues ?? 0}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Issues Reported
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm">
                <div className="text-3xl md:text-4xl font-bold text-emerald-600">
                  {stats?.resolvedIssues ?? 0}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Issues Resolved
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm">
                <div className="text-3xl md:text-4xl font-bold text-emerald-600">
                  {stats?.totalMunicipalities ?? 0}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Municipalities
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm">
                <div className="text-3xl md:text-4xl font-bold text-emerald-600">
                  {stats?.avgResponseTime ?? 0}h
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Avg Response
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works - Clean steps */}
        <section className="py-20">
          <div className="container px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">How It Works</h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                Three simple steps to report issues and track their resolution.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-5">
                  <span className="text-xl font-bold text-emerald-600">1</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Report</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  Take a photo and describe the issue. Your report can be anonymous.
                </p>
              </div>

              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-5">
                  <span className="text-xl font-bold text-emerald-600">2</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Verify</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  Reports are verified and routed to the appropriate municipality.
                </p>
              </div>

              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-5">
                  <span className="text-xl font-bold text-emerald-600">3</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Track</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  Monitor progress and see when your issue gets resolved.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
