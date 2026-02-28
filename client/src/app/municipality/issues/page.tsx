"use client";

import { useState, useEffect, useCallback } from "react";
import { Header, Footer } from "@/components/layout";
import { MunicipalityOnly } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Filter,
  Loader2,
  Image as ImageIcon,
  Camera,
  X,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { uploadImage } from "@/lib/cloudinary";
import { PriorityBadge } from "@/components/agent/PriorityBadge";

interface Issue {
  id: string;
  description: string;
  type: string;
  status: "OPEN" | "CLOSED";
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  imageUrls?: string[];
  municipalityId?: string;
  municipalityResponse?: string;
  resolution?: {
    resolutionImageUrl?: string;
    resolutionNote?: string;
    respondedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
  // Priority fields (from AI agent)
  priority_score?: number;
  priority_severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  priority_reasoning?: string;
}

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  OPEN: {
    label: "Open",
    color: "text-red-700",
    bgColor: "bg-red-100",
  },
  CLOSED: {
    label: "Closed",
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
};

const issueTypeLabels: Record<string, string> = {
  POTHOLE: "Pothole",
  GARBAGE: "Garbage",
  DRAINAGE: "Drainage",
  STREETLIGHT: "Streetlight",
  ROAD_DAMAGE: "Road Damage",
  WATER_SUPPLY: "Water Supply",
  SEWAGE: "Sewage",
  ENCROACHMENT: "Encroachment",
  SANITATION: "Sanitation",
  PARKS: "Parks & Gardens",
  OTHER: "Other",
};

export default function MunicipalityIssuesPage() {
  return (
    <MunicipalityOnly>
      <IssuesContent />
    </MunicipalityOnly>
  );
}

function IssuesContent() {
  const { getToken, userProfile } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");

  // Resolve dialog state
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolutionImage, setResolutionImage] = useState<File | null>(null);
  const [resolutionImagePreview, setResolutionImagePreview] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();

      const params = new URLSearchParams();
      if (userProfile?.municipalityId) {
        params.append("municipalityId", userProfile.municipalityId);
      }
      params.append("pageSize", "500");

      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
        }/issues?${params}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      const data = await response.json();

      if (data.success && data.data?.items) {
        setIssues(data.data.items);
      }
    } catch (error) {
      console.error("Error fetching issues:", error);
      toast.error("Failed to load issues");
    } finally {
      setLoading(false);
    }
  }, [getToken, userProfile?.municipalityId]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Filter and sort issues based on tab, search, and sort option
  const filteredIssues = issues
    .filter((issue) => {
      // Tab filter
      if (activeTab === "pending" && issue.status !== "OPEN") return false;
      if (activeTab === "resolved" && issue.status !== "CLOSED") return false;

      // Type filter
      if (typeFilter !== "all" && issue.type !== typeFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          issue.description.toLowerCase().includes(query) ||
          issue.type.toLowerCase().includes(query) ||
          issue.location.address?.toLowerCase().includes(query)
        );
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === "priority") {
        // Sort by priority score (highest first), then by date
        const scoreA = a.priority_score || 0;
        const scoreB = b.priority_score || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
      }
      // Default: sort by date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Stats
  const stats = {
    pending: issues.filter((i) => i.status === "OPEN").length,
    resolved: issues.filter((i) => i.status === "CLOSED").length,
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResolutionImage(file);
      const reader = new FileReader();
      reader.onload = () => setResolutionImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Handle resolve submission
  const handleResolve = async () => {
    if (!selectedIssue) return;

    if (!resolutionNote.trim()) {
      toast.error("Please add a note describing the resolution");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      let imageUrl: string | undefined;

      // Upload image if provided
      if (resolutionImage) {
        const uploadResult = await uploadImage(resolutionImage);
        if (uploadResult.success && uploadResult.url) {
          imageUrl = uploadResult.url;
        } else {
          toast.error("Failed to upload image");
          setIsSubmitting(false);
          return;
        }
      }

      // Submit resolution
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
        }/issues/${selectedIssue.id}/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            resolutionNote: resolutionNote,
            resolutionImageUrl: imageUrl,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Issue resolved successfully!");
        setSelectedIssue(null);
        setResolutionNote("");
        setResolutionImage(null);
        setResolutionImagePreview(null);
        fetchIssues();
      } else {
        toast.error(data.error || "Failed to resolve issue");
      }
    } catch (error) {
      console.error("Error resolving issue:", error);
      toast.error("Failed to resolve issue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDaysAgo = (dateString: string) => {
    const days = Math.floor(
      (Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  };

  const openInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-1 container py-4 md:py-6 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4 mb-4 md:mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Issues Dashboard</h1>
              <p className="text-sm md:text-base text-gray-600">
                {userProfile?.displayName || "Your Municipality"}
              </p>
            </div>
            <Button onClick={fetchIssues} variant="outline" size="sm" className="w-full sm:w-auto">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Stats Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4 md:mb-6">
            <TabsList className="grid w-full grid-cols-2 h-auto p-1">
              <TabsTrigger
                value="pending"
                className="flex flex-col py-2 md:py-3 data-[state=active]:bg-yellow-100 data-[state=active]:text-yellow-800"
              >
                <span className="text-xl md:text-2xl font-bold">{stats.pending}</span>
                <span className="text-xs">Pending</span>
              </TabsTrigger>
              <TabsTrigger
                value="resolved"
                className="flex flex-col py-2 md:py-3 data-[state=active]:bg-green-100 data-[state=active]:text-green-800"
              >
                <span className="text-xl md:text-2xl font-bold">{stats.resolved}</span>
                <span className="text-xs">Resolved</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 md:gap-3 mb-4 md:mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Issue Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(issueTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Newest First</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Issues List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <Skeleton className="h-24 w-24 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredIssues.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {activeTab === "pending"
                    ? "No Pending Issues!"
                    : "No Issues Found"}
                </h3>
                <p className="text-gray-500">
                  {activeTab === "pending"
                    ? "Great job! All issues have been addressed."
                    : "Try adjusting your filters."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onResolve={() => {
                    setSelectedIssue(issue);
                    setResolutionNote("");
                    setResolutionImage(null);
                    setResolutionImagePreview(null);
                  }}
                  onViewLocation={() =>
                    openInMaps(
                      issue.location.latitude,
                      issue.location.longitude
                    )
                  }
                  getDaysAgo={getDaysAgo}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Resolve Dialog */}
      <Dialog
        open={!!selectedIssue}
        onOpenChange={(open) => !open && setSelectedIssue(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-w-[90vw] w-full mx-4">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Resolve Issue</DialogTitle>
            <DialogDescription className="text-sm">
              Upload a photo of the fixed issue and add a note
            </DialogDescription>
          </DialogHeader>

          {selectedIssue && (
            <div className="space-y-4 md:space-y-6">
              {/* Issue Preview */}
              <div className="bg-gray-50 rounded-lg p-3 md:p-4">
                <div className="flex gap-3">
                  {selectedIssue.imageUrls?.[0] && (
                    <img
                      src={selectedIssue.imageUrls[0]}
                      alt="Issue"
                      className="h-16 w-16 md:h-20 md:w-20 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <Badge
                      className={`${
                        statusConfig[selectedIssue.status].bgColor
                      } ${statusConfig[selectedIssue.status].color} border-0 text-xs`}
                    >
                      {issueTypeLabels[selectedIssue.type] ||
                        selectedIssue.type}
                    </Badge>
                    <p className="text-xs md:text-sm mt-1 line-clamp-2">
                      {selectedIssue.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">
                        {selectedIssue.location.address || "Location on map"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Resolution Image Upload */}
              <div className="space-y-2">
                <Label className="text-sm md:text-base">Resolution Photo</Label>
                <p className="text-xs md:text-sm text-gray-500">
                  Upload a photo showing the issue has been fixed (optional)
                </p>

                {resolutionImagePreview ? (
                  <div className="relative">
                    <img
                      src={resolutionImagePreview}
                      alt="Resolution preview"
                      className="w-full h-40 md:h-48 object-cover rounded-lg"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2 h-7 w-7 md:h-8 md:w-8"
                      onClick={() => {
                        setResolutionImage(null);
                        setResolutionImagePreview(null);
                      }}
                    >
                      <X className="h-3 w-3 md:h-4 md:w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 md:h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col items-center justify-center py-4 md:pt-5 md:pb-6">
                      <Camera className="h-8 w-8 md:h-10 md:w-10 text-gray-400 mb-2" />
                      <p className="text-xs md:text-sm text-gray-500 px-4 text-center">
                        <span className="font-medium text-primary">
                          Click to upload
                        </span>{" "}
                        or drag and drop
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        PNG, JPG up to 10MB
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageSelect}
                    />
                  </label>
                )}
              </div>

              {/* Resolution Note */}
              <div className="space-y-2">
                <Label className="text-sm md:text-base">Resolution Note *</Label>
                <Textarea
                  placeholder="Describe what was done to fix this issue..."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={3}
                  className="text-sm md:text-base"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button 
              variant="outline" 
              onClick={() => setSelectedIssue(null)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={isSubmitting || !resolutionNote.trim()}
              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as Resolved
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Issue Card Component
function IssueCard({
  issue,
  onResolve,
  onViewLocation,
  getDaysAgo,
}: {
  issue: Issue;
  onResolve: () => void;
  onViewLocation: () => void;
  getDaysAgo: (date: string) => string;
}) {
  const status = statusConfig[issue.status];
  const isPending = issue.status === "OPEN";

  return (
    <Card
      className={`overflow-hidden ${
        isPending ? "border-l-4 border-l-yellow-500" : ""
      }`}
    >
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Image */}
          <div className="sm:w-32 h-32 sm:h-auto bg-gray-100 flex-shrink-0">
            {issue.imageUrls?.[0] ? (
              <img
                src={issue.imageUrls[0]}
                alt="Issue"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-gray-300" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {issueTypeLabels[issue.type] || issue.type}
                </Badge>
                <Badge
                  className={`${status.bgColor} ${status.color} border-0 text-xs`}
                >
                  {status.label}
                </Badge>
                {/* Priority Badge */}
                {issue.priority_score && issue.priority_severity && (
                  <PriorityBadge
                    score={issue.priority_score}
                    severity={issue.priority_severity}
                    reasoning={issue.priority_reasoning}
                    size="sm"
                  />
                )}
              </div>
              <span className="text-xs text-gray-500">
                {getDaysAgo(issue.createdAt)}
              </span>
            </div>

            <p className="text-sm text-gray-700 mb-3 line-clamp-2">
              {issue.description}
            </p>

            <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
              <MapPin className="h-3 w-3" />
              <span className="truncate">
                {issue.location.address ||
                  `${issue.location.latitude.toFixed(
                    4
                  )}, ${issue.location.longitude.toFixed(4)}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onViewLocation}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>

            {/* Resolution info if resolved */}
            {issue.resolution?.resolutionNote && (
              <div className="bg-green-50 rounded-lg p-3 mb-3">
                <p className="text-xs font-medium text-green-800 mb-1">
                  Resolution:
                </p>
                <p className="text-xs text-green-700">
                  {issue.resolution.resolutionNote}
                </p>
                {issue.resolution.resolutionImageUrl && (
                  <img
                    src={issue.resolution.resolutionImageUrl}
                    alt="Resolution"
                    className="mt-2 h-16 w-16 object-cover rounded"
                  />
                )}
              </div>
            )}

            {/* Actions */}
            {isPending && (
              <Button
                size="sm"
                onClick={onResolve}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Resolve Issue
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
