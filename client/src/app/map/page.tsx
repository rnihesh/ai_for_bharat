"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Header, Footer } from "@/components/layout";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { issuesApi, municipalitiesApi, mlApi } from "@/lib/api";
import { agentApi } from "@/lib/agentApi";
import {
  MapPin,
  Filter,
  List,
  Map as MapIcon,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
  Thermometer,
} from "lucide-react";
import { PriorityBadge } from "@/components/agent/PriorityBadge";

// Dynamically import Google Maps to avoid SSR issues
const GoogleMapComponent = dynamic(
  () =>
    import("@/components/map/GoogleMap").then((mod) => mod.GoogleMapComponent),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-muted">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    ),
  }
);

interface IssuePriority {
  score: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  reasoning?: string;
}

interface Issue {
  id: string;
  description: string;
  type: string;
  status: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  createdAt: string;
  municipalityId: string;
  imageUrls?: string[];
  priority?: IssuePriority;
}

interface MunicipalityBounds {
  id: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface ClusterData {
  id: string;
  centroid: { latitude: number; longitude: number };
  issueCount: number;
  aggregateSeverity: number;
  severityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  dominantType: string | null;
  typeCounts: Record<string, number>;
  radiusMeters: number;
  issueIds: string[];
}

interface RiskGridPoint {
  latitude: number;
  longitude: number;
  riskScore: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

const issueTypes = [
  { value: "all", label: "All Types" },
  { value: "POTHOLE", label: "Pothole" },
  { value: "GARBAGE", label: "Garbage" },
  { value: "DRAINAGE", label: "Drainage" },
  { value: "STREETLIGHT", label: "Streetlight" },
  { value: "ROAD_DAMAGE", label: "Road Damage" },
  { value: "WATER_SUPPLY", label: "Water Supply" },
];

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "OPEN":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "CLOSED":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    OPEN: "destructive",
    CLOSED: "default",
  };
  const labels: Record<string, string> = {
    OPEN: "Open",
    CLOSED: "Closed",
  };
  return (
    <Badge variant={variants[status] || "secondary"}>
      {labels[status] || status}
    </Badge>
  );
};

const getTypeBadge = (type: string) => {
  const colors: Record<string, string> = {
    POTHOLE: "bg-orange-100 text-orange-800",
    GARBAGE: "bg-green-100 text-green-800",
    DRAINAGE: "bg-blue-100 text-blue-800",
    STREETLIGHT: "bg-yellow-100 text-yellow-800",
    ROAD_DAMAGE: "bg-red-100 text-red-800",
    WATER_SUPPLY: "bg-cyan-100 text-cyan-800",
    OTHER: "bg-gray-100 text-gray-800",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${
        colors[type] || colors.OTHER
      }`}
    >
      {type.replace(/_/g, " ")}
    </span>
  );
};

export default function MapPage() {
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [isLoading, setIsLoading] = useState(true);
  const [isPriorityLoading, setIsPriorityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
  });
  const [issues, setIssues] = useState<Issue[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityBounds[]>(
    []
  );
  const [showBorders, setShowBorders] = useState(true);
  const [showClusters, setShowClusters] = useState(false);
  const [showRiskHeatmap, setShowRiskHeatmap] = useState(false);
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [riskData, setRiskData] = useState<{
    predictions: RiskGridPoint[];
    bounds: { north: number; south: number; east: number; west: number };
    gridSize: number;
  } | null>(null);
  const [isClusterLoading, setIsClusterLoading] = useState(false);
  const [isRiskLoading, setIsRiskLoading] = useState(false);
  const [mapBounds, setMapBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);

  // Fetch municipalities with bounds
  useEffect(() => {
    const fetchMunicipalities = async () => {
      try {
        const result = await municipalitiesApi.getAll({ pageSize: 500 });
        if (result.success && result.data?.items) {
          const municipalitiesWithBounds = (
            result.data.items as Array<{
              id: string;
              name: string;
              bounds?: {
                north: number;
                south: number;
                east: number;
                west: number;
              };
            }>
          )
            .filter((m) => m.bounds) // Only include municipalities with bounds
            .map((m) => ({
              id: m.id,
              name: m.name,
              bounds: m.bounds!,
            }));
          setMunicipalities(municipalitiesWithBounds);
        }
      } catch (err) {
        console.error("Error fetching municipalities:", err);
      }
    };
    fetchMunicipalities();
  }, []);

  useEffect(() => {
    const fetchIssues = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const statusFilters =
          filters.status !== "all" ? [filters.status] : undefined;
        const typeFilters = filters.type !== "all" ? [filters.type] : undefined;

        const result = await issuesApi.getAll({
          status: statusFilters,
          type: typeFilters,
        });

        if (result.success && result.data?.items) {
          // Map raw items to Issue type, including stored priority from DynamoDB
          const fetchedIssues = (result.data.items as any[]).map((item) => {
            const issue: Issue = {
              id: item.id,
              description: item.description,
              type: item.type,
              status: item.status,
              location: item.location,
              createdAt: item.createdAt,
              municipalityId: item.municipalityId,
              imageUrls: item.imageUrls,
            };

            // Map stored priority fields from DynamoDB (flat structure) to nested structure
            if (item.priority_score !== undefined && item.priority_severity) {
              issue.priority = {
                score: item.priority_score,
                severity: item.priority_severity as IssuePriority["severity"],
                reasoning: item.priority_reasoning || undefined,
              };
            }

            return issue;
          });

          setIssues(fetchedIssues);

          // Only score issues that don't have stored priority (fallback for old issues)
          // This runs once per issue, and the score is saved to DynamoDB
          const openIssuesWithoutPriority = fetchedIssues.filter(
            (issue) => issue.status === "OPEN" && !issue.priority
          );

          if (openIssuesWithoutPriority.length > 0) {
            setIsPriorityLoading(true);
            // Score issues in background (don't block UI) - limit to 5 to avoid overload
            (async () => {
              try {
                const priorityPromises = openIssuesWithoutPriority.slice(0, 5).map(async (issue) => {
                  try {
                    // This API call now SAVES the priority to DynamoDB
                    const score = await agentApi.priority.score({
                      issue_id: issue.id,
                      image_url: issue.imageUrls?.[0],
                      description: issue.description,
                      location: issue.location ? {
                        lat: issue.location.latitude,
                        lng: issue.location.longitude,
                      } : undefined,
                      issue_type: issue.type,
                    });
                    return { issueId: issue.id, priority: score };
                  } catch (e) {
                    console.error(`Failed to score issue ${issue.id}:`, e);
                    return null;
                  }
                });

                const priorityResults = (await Promise.all(priorityPromises)).filter(Boolean);

                // Update issues with priority scores (for immediate display)
                if (priorityResults.length > 0) {
                  setIssues((prevIssues) => {
                    return prevIssues.map((issue) => {
                      const priorityResult = priorityResults.find(
                        (r) => r?.issueId === issue.id
                      );
                      if (priorityResult) {
                        return {
                          ...issue,
                          priority: {
                            score: priorityResult.priority.score,
                            severity: priorityResult.priority.severity,
                            reasoning: priorityResult.priority.reasoning,
                          },
                        };
                      }
                      return issue;
                    });
                  });
                }
              } catch (e) {
                console.error("Error fetching priority scores:", e);
              } finally {
                setIsPriorityLoading(false);
              }
            })();
          }
        } else {
          setError(result.error || "Failed to fetch issues");
          setIssues([]);
        }
      } catch (err) {
        console.error("Error fetching issues:", err);
        setError("Network error. Please try again.");
        setIssues([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIssues();
  }, [filters]);

  // Fetch clusters when clustering is enabled
  useEffect(() => {
    if (!showClusters) {
      setClusters([]);
      return;
    }

    const fetchClusters = async () => {
      setIsClusterLoading(true);
      try {
        const result = await mlApi.cluster({
          bounds: mapBounds || undefined,
          status: filters.status !== "all" ? filters.status : undefined,
        });

        if (result.success && result.data) {
          setClusters(result.data.clusters);
        }
      } catch (err) {
        console.error("Error fetching clusters:", err);
      } finally {
        setIsClusterLoading(false);
      }
    };

    fetchClusters();
  }, [showClusters, mapBounds, filters.status]);

  // Fetch risk heatmap data when enabled
  useEffect(() => {
    if (!showRiskHeatmap || !mapBounds) {
      setRiskData(null);
      return;
    }

    const fetchRiskData = async () => {
      setIsRiskLoading(true);
      try {
        const result = await mlApi.predictRiskGrid({
          bounds: mapBounds,
          grid_size: 8,
        });

        if (result.success && result.data) {
          setRiskData(result.data);
        }
      } catch (err) {
        console.error("Error fetching risk data:", err);
      } finally {
        setIsRiskLoading(false);
      }
    };

    fetchRiskData();
  }, [showRiskHeatmap, mapBounds]);

  const filteredIssues = issues.filter((issue) => {
    const matchesSearch =
      issue.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.location.address
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ??
        false);
    return matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col">
        {/* Filters Bar */}
        <div className="border-b bg-background sticky top-16 z-40">
          <div className="container px-4 py-3 md:py-4">
            <div className="flex flex-col gap-3 md:gap-4">
              {/* Search */}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search issues or locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2 md:gap-3 items-center">
                <Select
                  value={filters.type}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {issueTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* View Toggle */}
                <div className="flex border rounded-lg overflow-hidden w-full sm:w-auto">
                  <Button
                    variant={viewMode === "map" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("map")}
                    className="rounded-none flex-1 sm:flex-none"
                  >
                    <MapIcon className="h-4 w-4 mr-1" />
                    <span className="text-xs md:text-sm">Map</span>
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="rounded-none flex-1 sm:flex-none"
                  >
                    <List className="h-4 w-4 mr-1" />
                    <span className="text-xs md:text-sm">List</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {viewMode === "map" ? (
            /* Map View */
            <div className="relative h-[calc(100vh-12rem)]">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <div className="text-center space-y-4">
                    <Skeleton className="h-12 w-12 mx-auto rounded-full" />
                    <p className="text-muted-foreground">Loading map...</p>
                  </div>
                </div>
              ) : (
                <>
                  <GoogleMapComponent
                    issues={filteredIssues}
                    municipalities={municipalities}
                    clusters={clusters}
                    riskData={riskData || undefined}
                    showMunicipalityBorders={showBorders}
                    showClusters={showClusters}
                    showRiskHeatmap={showRiskHeatmap}
                    onBoundsChange={setMapBounds}
                  />
                  {/* Issue count overlay */}
                  <div className="absolute top-4 left-4 bg-background/95 backdrop-blur rounded-lg p-3 shadow-lg z-10">
                    <p className="text-sm font-medium">
                      {showClusters
                        ? `${clusters.length} clusters`
                        : `${filteredIssues.length} issues`}
                    </p>
                    {municipalities.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {municipalities.length} municipalities
                      </p>
                    )}
                    {isPriorityLoading && (
                      <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                        <span className="animate-spin inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full"></span>
                        Calculating priorities...
                      </p>
                    )}
                    {isClusterLoading && (
                      <p className="text-xs text-purple-600 flex items-center gap-1 mt-1">
                        <span className="animate-spin inline-block w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full"></span>
                        Loading clusters...
                      </p>
                    )}
                    {isRiskLoading && (
                      <p className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                        <span className="animate-spin inline-block w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full"></span>
                        Loading risk data...
                      </p>
                    )}
                  </div>

                  {/* ML Features Toggle Panel */}
                  <div className="absolute top-4 right-4 bg-background/95 backdrop-blur rounded-lg p-3 shadow-lg z-10">
                    <p className="text-xs font-medium mb-2">ML Features</p>
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowClusters(!showClusters)}
                        className={`flex items-center gap-2 text-xs px-2 py-1 rounded w-full ${
                          showClusters
                            ? "bg-purple-100 text-purple-800"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <Layers className="h-3 w-3" />
                        {showClusters ? "Hide" : "Show"} Clusters
                      </button>
                      <button
                        onClick={() => setShowRiskHeatmap(!showRiskHeatmap)}
                        className={`flex items-center gap-2 text-xs px-2 py-1 rounded w-full ${
                          showRiskHeatmap
                            ? "bg-orange-100 text-orange-800"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <Thermometer className="h-3 w-3" />
                        {showRiskHeatmap ? "Hide" : "Show"} Risk Map
                      </button>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur rounded-lg p-3 shadow-lg z-10 max-h-[300px] overflow-y-auto">
                    <p className="text-xs font-medium mb-2">
                      {showClusters ? "Cluster" : "Priority"} Legend
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow"></div>
                        <span>Critical</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-3.5 h-3.5 rounded-full bg-orange-600 border-2 border-white shadow"></div>
                        <span>High</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full bg-yellow-600 border-2 border-white shadow"></div>
                        <span>Medium</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-600 border-2 border-white shadow"></div>
                        <span>Low</span>
                      </div>
                      {!showClusters && (
                        <div className="border-t my-2 pt-2">
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span>Closed</span>
                          </div>
                        </div>
                      )}
                      {showRiskHeatmap && (
                        <div className="border-t my-2 pt-2">
                          <p className="text-xs font-medium mb-1">Risk Level</p>
                          <div className="h-2 w-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded"></div>
                          <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                            <span>Low</span>
                            <span>High</span>
                          </div>
                        </div>
                      )}
                      <div className="border-t my-2 pt-2">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-3 h-3 border-2 border-indigo-500 bg-indigo-500/10"></div>
                          <span>Municipality Border</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowBorders(!showBorders)}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        {showBorders ? "Hide" : "Show"} borders
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* List View */
            <div className="container px-4 py-4 md:py-6">
              <div className="grid gap-3 md:gap-4">
                {isLoading ? (
                  Array(4)
                    .fill(0)
                    .map((_, i) => (
                      <Card key={i}>
                        <CardContent className="p-6">
                          <div className="flex gap-4">
                            <Skeleton className="h-20 w-20 rounded-lg" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-5 w-3/4" />
                              <Skeleton className="h-4 w-1/2" />
                              <Skeleton className="h-4 w-1/4" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                ) : filteredIssues.length === 0 ? (
                  <Card className="text-center py-12">
                    <CardContent>
                      <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        No issues found
                      </h3>
                      <p className="text-muted-foreground">
                        Try adjusting your filters or search query
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredIssues.map((issue) => (
                    <Card
                      key={issue.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <CardContent className="p-3 md:p-6">
                        <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                          {/* Thumbnail */}
                          {issue.imageUrls && issue.imageUrls.length > 0 ? (
                            <img
                              src={issue.imageUrls[0]}
                              alt="Issue"
                              className="w-full sm:w-20 sm:h-20 h-40 object-cover rounded-lg sm:shrink-0"
                            />
                          ) : (
                            <div className="w-full sm:w-20 sm:h-20 h-40 bg-muted rounded-lg flex items-center justify-center sm:shrink-0">
                              <MapPin className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-2 mb-2">
                              <h3 className="font-semibold text-sm md:text-base line-clamp-2">
                                {issue.description}
                              </h3>
                              <div className="flex items-center gap-2 shrink-0">
                                {getStatusIcon(issue.status)}
                                {getStatusBadge(issue.status)}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-muted-foreground mb-2">
                              {getTypeBadge(issue.type)}
                              {issue.priority && (
                                <>
                                  <span className="hidden sm:inline">•</span>
                                  <PriorityBadge
                                    score={issue.priority.score}
                                    severity={issue.priority.severity}
                                    reasoning={issue.priority.reasoning}
                                    size="sm"
                                  />
                                </>
                              )}
                              <span className="hidden sm:inline">•</span>
                              <span className="text-xs">
                                {new Date(issue.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {issue.location.address ||
                                  `${issue.location.latitude.toFixed(4)}, ${issue.location.longitude.toFixed(4)}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
