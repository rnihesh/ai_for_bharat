"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Menu,
  MapPin,
  Trophy,
  Building2,
  User,
  LogIn,
  LogOut,
  LayoutDashboard,
  Loader2,
  Shield,
  FileText,
  Users,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/auth/UserMenu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Navigation items for different user roles
const getNavigation = (role: string | undefined) => {
  if (role === "PLATFORM_MAINTAINER" || role === "admin") {
    // Admin: full access to all management pages plus map view
    return [
      { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { name: "Map View", href: "/map", icon: MapPin },
      { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
      { name: "Municipalities", href: "/municipalities", icon: Building2 },
    ];
  }

  if (role === "MUNICIPALITY_USER") {
    // Municipality: view and solve issues in their area
    return [
      { name: "Issues", href: "/municipality/issues", icon: ClipboardList },
      { name: "Map View", href: "/map", icon: MapPin },
    ];
  }

  // Citizen or not logged in: report issue, map view, leaderboard (no municipalities)
  return [
    { name: "Report Issue", href: "/report", icon: FileText },
    { name: "Map View", href: "/map", icon: MapPin },
    { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
  ];
};

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, userProfile, signOut, loading, profileLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isLoggedIn = !!user;
  const userRole = userProfile?.role;

  // Debug log for role issues
  useEffect(() => {
    if (user && userProfile) {
      console.log("[Header] User role:", userProfile.role);
    }
  }, [user, userProfile]);

  // If user is logged in but profile not loaded yet, don't show nav (avoid flicker)
  const isProfileLoading = isLoggedIn && (profileLoading || !userProfile);

  const navigation = useMemo(() => {
    if (isProfileLoading) return []; // Don't show nav while loading profile
    return getNavigation(userRole ?? undefined);
  }, [userRole, isProfileLoading]);

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsOpen(false);
      toast.success("Signed out successfully");
      router.push("/");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <span className="font-bold text-xl text-emerald-700 dark:text-emerald-500">
            Civic<span className="text-gray-900 dark:text-white">Lemma</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  isActive 
                    ? "text-primary font-semibold" 
                    : "text-muted-foreground"
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center space-x-4">
          {loading ? (
            <Button variant="ghost" size="icon" disabled>
              <Loader2 className="h-5 w-5 animate-spin" />
            </Button>
          ) : isLoggedIn ? (
            <UserMenu />
          ) : (
            <Button asChild size="sm">
              <Link href="/auth/login">Sign In</Link>
            </Button>
          )}
        </div>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0 border-r-0">
            <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/20">
              {/* Header */}
              <div className="flex items-center gap-3 p-5 border-b">
                <div>
                  <SheetTitle className="text-xl font-bold tracking-tight">
                    <span className="text-emerald-600">Civic</span>
                    <span className="text-gray-900 dark:text-white">Lemma</span>
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground">Civic Issue Platform</p>
                </div>
              </div>
              
              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto py-4 px-3">
                <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Navigation
                </p>
                <div className="space-y-1">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:bg-primary/10 hover:text-primary hover:translate-x-1 active:scale-[0.98]",
                          isActive 
                            ? "bg-primary/10 text-primary font-semibold" 
                            : "text-foreground/80"
                        )}
                      >
                        <div className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg",
                          isActive ? "bg-primary/20" : "bg-muted"
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </nav>
              
              {/* Footer */}
              <div className="border-t bg-muted/30 p-4 space-y-2">
                {loading ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : isLoggedIn ? (
                  <>
                    <Link
                      href="/profile"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground/80 transition-all hover:bg-primary/10 hover:text-primary"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <User className="h-5 w-5" />
                      </div>
                      <span>Profile</span>
                    </Link>
                    <Button
                      variant="outline"
                      className="w-full h-11 justify-start gap-3 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <Button asChild className="w-full h-11 justify-start gap-3 rounded-xl shadow-md">
                    <Link href="/auth/login" onClick={() => setIsOpen(false)}>
                      <LogIn className="h-4 w-4" />
                      Sign In
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
