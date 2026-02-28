"use client";

import { Header, Footer } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">
              Terms of Service
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Acceptance of Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
              <p>
                By accessing and using CivicLemma ("the Platform"), you accept
                and agree to be bound by these Terms of Service. If you do not
                agree to these terms, please do not use the Platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Use of the Platform</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  1. Permitted Use
                </h3>
                <p>CivicLemma may be used to:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Report legitimate civic issues in your community</li>
                  <li>
                    View and track civic issues on maps and leaderboards
                  </li>
                  <li>
                    Manage and resolve issues (municipality accounts only)
                  </li>
                  <li>Access analytics and performance metrics</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  2. Prohibited Use
                </h3>
                <p>You agree NOT to:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Submit false, misleading, or fraudulent reports</li>
                  <li>
                    Upload inappropriate, offensive, or illegal content
                  </li>
                  <li>
                    Attempt to access unauthorized areas of the Platform
                  </li>
                  <li>
                    Use automated systems (bots) to spam or abuse the Platform
                  </li>
                  <li>Harass, threaten, or harm others</li>
                  <li>
                    Violate any applicable laws or regulations
                  </li>
                  <li>
                    Reverse engineer, decompile, or extract the source code
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Responsibilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  For Citizens Reporting Issues:
                </h3>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Ensure reports are accurate and truthful</li>
                  <li>Provide clear photos and descriptions</li>
                  <li>Select the correct issue category</li>
                  <li>
                    Only report genuine civic issues that require municipal
                    attention
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  For Municipality Accounts:
                </h3>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Maintain confidentiality of login credentials</li>
                  <li>
                    Review and respond to issues in a timely manner
                  </li>
                  <li>Provide accurate status updates</li>
                  <li>
                    Use the Platform only for authorized municipal purposes
                  </li>
                  <li>
                    Comply with data protection and privacy regulations
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content Ownership and License</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  User-Generated Content
                </h3>
                <p>
                  When you submit an issue report (including photos and
                  descriptions), you grant CivicLemma a non-exclusive,
                  worldwide, royalty-free license to:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Display the content to relevant municipalities</li>
                  <li>
                    Use the content to improve AI classification models
                  </li>
                  <li>
                    Include anonymized data in analytics and leaderboards
                  </li>
                </ul>
                <p>
                  You represent that you have the right to submit the content
                  and that it does not violate any third-party rights.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  Platform Content
                </h3>
                <p>
                  All Platform code, design, features, and branding are owned by
                  CivicLemma and protected by intellectual property laws.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Disclaimers and Limitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  1. Platform Availability
                </h3>
                <p>
                  We strive to provide reliable service, but the Platform is
                  provided "as is" without warranties. We do not guarantee
                  uninterrupted or error-free operation.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  2. Issue Resolution
                </h3>
                <p>
                  CivicLemma facilitates reporting but does NOT guarantee that
                  municipalities will resolve reported issues. We are not
                  responsible for municipal actions or inactions.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  3. AI Classification
                </h3>
                <p>
                  Our AI-powered classification may not always be 100% accurate.
                  Users and municipalities should verify issue categories as
                  needed.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  4. Third-Party Services
                </h3>
                <p>
                  The Platform integrates with third-party services (e.g.,
                  Google Maps, Firebase). We are not responsible for
                  third-party service availability or policies.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="text-sm md:text-base text-muted-foreground">
              <p>
                To the maximum extent permitted by law, CivicLemma and its
                developers shall not be liable for any indirect, incidental,
                special, consequential, or punitive damages arising from your
                use of the Platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Termination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base text-muted-foreground">
              <p>We reserve the right to:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Suspend or terminate accounts that violate these terms</li>
                <li>Remove content that violates our policies</li>
                <li>
                  Modify or discontinue the Platform at any time with or without
                  notice
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Privacy</CardTitle>
            </CardHeader>
            <CardContent className="text-sm md:text-base text-muted-foreground">
              <p>
                Your use of the Platform is also governed by our{" "}
                <a href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </a>
                , which explains how we collect and use your information.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent className="text-sm md:text-base text-muted-foreground">
              <p>
                We may modify these Terms of Service at any time. Continued use
                of the Platform after changes constitutes acceptance of the
                updated terms. Material changes will be communicated through the
                Platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Governing Law</CardTitle>
            </CardHeader>
            <CardContent className="text-sm md:text-base text-muted-foreground">
              <p>
                These terms are governed by applicable laws. Any disputes shall
                be resolved through appropriate legal channels.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="text-sm md:text-base text-muted-foreground">
              <p>
                For questions about these Terms of Service, please contact us
                through the{" "}
                <a href="/contact" className="text-primary hover:underline">
                  contact page
                </a>
                .
              </p>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="pt-6 text-sm md:text-base text-muted-foreground">
              <p className="font-semibold text-foreground mb-2">
                Acknowledgment
              </p>
              <p>
                By using CivicLemma, you acknowledge that you have read,
                understood, and agree to be bound by these Terms of Service.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
