"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import { AdminOnly } from "@/components/auth/ProtectedRoute";
import { municipalitiesApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Users,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

interface Municipality {
  id: string;
  name: string;
  region?: string;
  district?: string;
  state: string;
  contactEmail?: string;
  contactPhone?: string;
  totalIssues?: number;
  resolvedIssues?: number;
  status?: "active" | "inactive";
}

export default function MunicipalitiesPage() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [filteredMunicipalities, setFilteredMunicipalities] = useState<
    Municipality[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchMunicipalities();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredMunicipalities(municipalities);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredMunicipalities(
        municipalities.filter(
          (m) =>
            m.name?.toLowerCase().includes(query) ||
            m.region?.toLowerCase().includes(query) ||
            m.district?.toLowerCase().includes(query) ||
            m.state?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, municipalities]);

  const fetchMunicipalities = async () => {
    try {
      setLoading(true);
      // Fetch all municipalities (pageSize up to 500 to get all)
      const response = await municipalitiesApi.getAll({ pageSize: 500 });
      if (response.data?.items) {
        const items = response.data.items as Municipality[];
        setMunicipalities(items);
        setFilteredMunicipalities(items);
      }
    } catch (err) {
      console.error("Error fetching municipalities:", err);
      setError("Failed to load municipalities");
    } finally {
      setLoading(false);
    }
  };

  const getResolutionRate = (resolved?: number, total?: number) => {
    if (!total || total === 0) return 0;
    return Math.round(((resolved || 0) / total) * 100);
  };

  return (
    <AdminOnly>
      <div className="min-h-screen flex flex-col bg-muted/30">
        <Header />

        <main className="flex-1 container py-8 px-4">
          <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Municipalities</h1>
              <p className="text-muted-foreground">
                Browse registered municipalities and their performance in
                resolving civic issues.
              </p>
            </div>

          {/* Search */}
          <div className="relative max-w-md mx-auto mb-8">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, region, or state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-6 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={fetchMunicipalities}>Try Again</Button>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!loading && !error && filteredMunicipalities.length === 0 && (
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-6 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No Municipalities Found
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search query."
                    : "No municipalities have been registered yet."}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Municipalities Grid */}
          {!loading && !error && filteredMunicipalities.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredMunicipalities.map((municipality) => (
                <MunicipalityCard
                  key={municipality.id}
                  municipality={municipality}
                />
              ))}
            </div>
          )}

          {/* Stats Summary */}
          {!loading && !error && municipalities.length > 0 && (
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Building2 className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold">{municipalities.length}</p>
                  <p className="text-muted-foreground text-sm">
                    Total Municipalities
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold">
                    {municipalities.filter((m) => m.status === "active").length}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Active Municipalities
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold">
                    {municipalities.reduce(
                      (acc, m) => acc + (m.totalIssues || 0),
                      0
                    )}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Total Issues Handled
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
    </AdminOnly>
  );
}

function MunicipalityCard({ municipality }: { municipality: Municipality }) {
  const router = useRouter();
  const resolutionRate = getResolutionRate(
    municipality.resolvedIssues,
    municipality.totalIssues
  );

  const handleViewIssues = () => {
    // Navigate to admin dashboard with municipality pre-selected
    router.push(`/admin/dashboard?tab=issues&municipality=${municipality.id}`);
  };

  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer group"
      onClick={handleViewIssues}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {municipality.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              {municipality.region || municipality.district || ""}
              {municipality.state ? `, ${municipality.state}` : ""}
            </CardDescription>
          </div>
          <Badge
            variant={municipality.status === "active" ? "default" : "secondary"}
          >
            {municipality.status === "active" ? (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            ) : (
              <Clock className="h-3 w-3 mr-1" />
            )}
            {municipality.status || "active"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contact Info */}
        <div className="space-y-2 text-sm">
          {municipality.contactEmail && (
            <div 
              className="flex items-center gap-2 text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <Mail className="h-4 w-4" />
              <a
                href={`mailto:${municipality.contactEmail}`}
                className="hover:underline"
              >
                {municipality.contactEmail}
              </a>
            </div>
          )}
          {municipality.contactPhone && (
            <div 
              className="flex items-center gap-2 text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="h-4 w-4" />
              <a
                href={`tel:${municipality.contactPhone}`}
                className="hover:underline"
              >
                {municipality.contactPhone}
              </a>
            </div>
          )}
        </div>

        {/* Performance Stats */}
        <div className="pt-2 border-t">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Resolution Rate</span>
            <span className="font-medium">{resolutionRate}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${resolutionRate}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{municipality.resolvedIssues || 0} resolved</span>
            <span>{municipality.totalIssues || 0} total</span>
          </div>
        </div>

        {/* View Issues Link */}
        <div className="pt-2 border-t flex items-center justify-between text-sm">
          <span className="text-muted-foreground">View all issues</span>
          <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-1 transition-transform" />
        </div>
      </CardContent>
    </Card>
  );
}

function getResolutionRate(resolved?: number, total?: number) {
  if (!total || total === 0) return 0;
  return Math.round(((resolved || 0) / total) * 100);
}
