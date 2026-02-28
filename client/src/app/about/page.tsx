"use client";

import { Header, Footer } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, Building2, TrendingUp } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">
              About CivicLemma
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Empowering citizens to report civic issues and hold municipalities
              accountable through technology.
            </p>
          </div>

          {/* Mission Section */}
          <Card>
            <CardHeader>
              <CardTitle>Our Mission</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                CivicLemma is a civic engagement platform designed to bridge the
                gap between citizens and local municipalities. We believe that
                everyone deserves a voice in improving their community, and
                municipalities need efficient tools to manage civic issues.
              </p>
              <p>
                Our platform enables citizens to report civic issues like
                potholes, garbage, damaged infrastructure, and more through an
                easy-to-use interface. Using AI-powered image classification, we
                automatically categorize issues and route them to the
                appropriate municipal authorities.
              </p>
            </CardContent>
          </Card>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg md:text-xl">
                    Location-Based Reporting
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm md:text-base text-muted-foreground">
                Report issues with precise GPS coordinates and view all issues
                on an interactive map.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg md:text-xl">
                    Anonymous & Secure
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm md:text-base text-muted-foreground">
                Report issues anonymously without sharing personal information
                with municipalities.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg md:text-xl">
                    Municipal Dashboard
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm md:text-base text-muted-foreground">
                Municipalities get a comprehensive dashboard to manage, track,
                and resolve issues efficiently.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg md:text-xl">
                    Leaderboard & Analytics
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm md:text-base text-muted-foreground">
                Track municipality performance and see which areas are most
                responsive to civic issues.
              </CardContent>
            </Card>
          </div>

          {/* Technology Section */}
          <Card>
            <CardHeader>
              <CardTitle>Technology Stack</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                CivicLemma is built with modern web technologies to ensure a
                fast, reliable, and scalable experience:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>
                  <strong>Frontend:</strong> Next.js 15 with React for a
                  responsive, mobile-first interface
                </li>
                <li>
                  <strong>Backend:</strong> Express.js with TypeScript for
                  robust API services
                </li>
                <li>
                  <strong>Database:</strong> Firebase Firestore for real-time
                  data synchronization
                </li>
                <li>
                  <strong>AI/ML:</strong> TensorFlow/Keras for image
                  classification and issue detection
                </li>
                <li>
                  <strong>Maps:</strong> Google Maps integration for precise
                  location services
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Built For Section */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6 text-center space-y-2">
              <p className="text-sm md:text-base text-muted-foreground">
                Built for <strong>GDG TechSprint</strong>
              </p>
              <p className="text-xs md:text-sm text-muted-foreground">
                A community-driven initiative to leverage technology for civic
                improvement
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
