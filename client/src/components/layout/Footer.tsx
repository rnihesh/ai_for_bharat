"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export function Footer() {
  const { userProfile } = useAuth();

  // Determine which links to show based on user role
  const role = userProfile?.role;

  return (
    <footer className="border-t bg-gray-50 dark:bg-gray-900/50">
      <div className="container px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 text-center sm:text-left">
          {/* Brand - Always visible */}
          <div className="space-y-4 flex flex-col items-center sm:items-start">
            <Link href="/" className="flex items-center">
              <span className="font-bold text-xl">
                <span className="text-emerald-600">Civic</span>
                <span className="text-gray-900 dark:text-white">Lemma</span>
              </span>
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              Empowering citizens to report civic issues and hold municipalities
              accountable.
            </p>
          </div>

          {/* Quick Links - Role-based */}
          <div>
            <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Quick Links</h3>
            <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
              {/* Public/Citizens - show reporting features */}
              {(!role || role === "USER") && (
                <>
                  <li>
                    <Link href="/" className="hover:text-primary transition-colors">
                      Report Issue
                    </Link>
                  </li>
                  <li>
                    <Link href="/map" className="hover:text-primary transition-colors">
                      Map View
                    </Link>
                  </li>
                  <li>
                    <Link href="/leaderboard" className="hover:text-primary transition-colors">
                      Leaderboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/municipalities" className="hover:text-primary transition-colors">
                      Municipalities
                    </Link>
                  </li>
                </>
              )}
              
              {/* Municipality Users */}
              {role === "MUNICIPALITY_USER" && (
                <>
                  <li>
                    <Link href="/municipality/issues" className="hover:text-primary transition-colors">
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/map" className="hover:text-primary transition-colors">
                      Map View
                    </Link>
                  </li>
                  <li>
                    <Link href="/leaderboard" className="hover:text-primary transition-colors">
                      Leaderboard
                    </Link>
                  </li>
                </>
              )}
              
              {/* Admin/Platform Maintainer */}
              {(role === "admin" || role === "PLATFORM_MAINTAINER") && (
                <>
                  <li>
                    <Link href="/admin/dashboard" className="hover:text-primary transition-colors">
                      Admin Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/map" className="hover:text-primary transition-colors">
                      Map View
                    </Link>
                  </li>
                  <li>
                    <Link href="/leaderboard" className="hover:text-primary transition-colors">
                      Leaderboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/municipalities" className="hover:text-primary transition-colors">
                      Municipalities
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Access/Account - Role-based */}
          <div>
            <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">
              {!role ? "Account" : "Account"}
            </h3>
            <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
              {!role ? (
                // Not logged in - show login only (no municipality links)
                <>
                  <li>
                    <Link href="/auth/login" className="hover:text-primary transition-colors">
                      Login
                    </Link>
                  </li>
                </>
              ) : (
                // Logged in - show profile
                <>
                  <li>
                    <Link href="/profile" className="hover:text-primary transition-colors">
                      My Profile
                    </Link>
                  </li>
                  {role === "MUNICIPALITY_USER" && (
                    <li>
                      <Link href="/municipality/issues" className="hover:text-primary transition-colors">
                        My Dashboard
                      </Link>
                    </li>
                  )}
                  {(role === "admin" || role === "PLATFORM_MAINTAINER") && (
                    <li>
                      <Link href="/admin/dashboard" className="hover:text-primary transition-colors">
                        Admin Panel
                      </Link>
                    </li>
                  )}
                </>
              )}
            </ul>
          </div>

          {/* About - Always visible */}
          <div>
            <h3 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">About</h3>
            <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 md:mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            &copy; {new Date().getFullYear()} CivicLemma. Built for GDG TechSprint.
          </p>
        </div>
      </div>
    </footer>
  );
}
