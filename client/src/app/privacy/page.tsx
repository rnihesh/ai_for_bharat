"use client";

import { Header, Footer } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">
              Privacy Policy
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
              <p>
                CivicLemma is committed to protecting your privacy. This Privacy
                Policy explains how we collect, use, and safeguard your
                information when you use our platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  1. Anonymous Issue Reports
                </h3>
                <p>
                  When you report a civic issue, we collect:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>GPS location of the issue</li>
                  <li>Photos of the issue</li>
                  <li>Issue category and description</li>
                  <li>Timestamp of the report</li>
                </ul>
                <p className="font-semibold">
                  Important: We do NOT collect any personal identifying
                  information from citizens reporting issues. Reports are
                  completely anonymous.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  2. Municipality Account Information
                </h3>
                <p>
                  For municipality and admin accounts, we collect:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Email address</li>
                  <li>Municipality name and location</li>
                  <li>Account role and permissions</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  3. Automatically Collected Information
                </h3>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Browser type and version</li>
                  <li>Device information</li>
                  <li>IP address (for security purposes only)</li>
                  <li>Usage statistics and analytics</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
              <p>We use the collected information to:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Route reported issues to the appropriate municipalities</li>
                <li>
                  Enable municipalities to track and resolve civic issues
                </li>
                <li>Generate analytics and leaderboards</li>
                <li>Improve our AI classification models</li>
                <li>Enhance platform security and prevent abuse</li>
                <li>Improve user experience and platform functionality</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Sharing and Disclosure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
              <p>We share information only in the following circumstances:</p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>
                  <strong>With Municipalities:</strong> Issue reports (photos,
                  location, category) are shared with the relevant municipality
                  to enable resolution. No personal identifying information is
                  shared.
                </li>
                <li>
                  <strong>Public Leaderboard:</strong> Aggregated, anonymized
                  statistics about municipality performance are publicly
                  displayed.
                </li>
                <li>
                  <strong>Legal Requirements:</strong> We may disclose
                  information if required by law or to protect rights, property,
                  or safety.
                </li>
              </ul>
              <p className="font-semibold">
                We do NOT sell or rent your personal information to third
                parties.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
              <p>
                We implement industry-standard security measures to protect your
                data:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Encrypted data transmission (HTTPS/SSL)</li>
                <li>Secure authentication with Firebase</li>
                <li>Regular security audits and updates</li>
                <li>Access controls and role-based permissions</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Rights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
              <p>You have the right to:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Access your data (for registered municipality accounts)</li>
                <li>Request deletion of your account and associated data</li>
                <li>Opt-out of analytics tracking</li>
                <li>Request corrections to your information</li>
              </ul>
              <p>
                For anonymous issue reports, since no personal information is
                collected, there is no personal data to access or delete.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cookies and Tracking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
              <p>We use cookies and similar technologies to:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Maintain your login session</li>
                <li>Remember your preferences</li>
                <li>Analyze platform usage and performance</li>
              </ul>
              <p>
                You can control cookies through your browser settings, but this
                may affect platform functionality.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Children's Privacy</CardTitle>
            </CardHeader>
            <CardContent className="text-sm md:text-base text-muted-foreground">
              <p>
                CivicLemma is designed for general public use. We do not
                knowingly collect personal information from children under 13.
                Issue reporting is anonymous for all users.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Changes to This Policy</CardTitle>
            </CardHeader>
            <CardContent className="text-sm md:text-base text-muted-foreground">
              <p>
                We may update this Privacy Policy from time to time. Changes
                will be posted on this page with an updated "Last updated" date.
                Continued use of the platform constitutes acceptance of the
                updated policy.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="text-sm md:text-base text-muted-foreground">
              <p>
                If you have questions about this Privacy Policy or how we handle
                your data, please contact us through the{" "}
                <a href="/contact" className="text-primary hover:underline">
                  contact page
                </a>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
