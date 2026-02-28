"use client";

import { useState, useEffect } from "react";
import { Header, Footer } from "@/components/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { municipalitiesApi } from "@/lib/api";
import {
  Trophy,
  Medal,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  Star,
} from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  municipality: {
    id: string;
    name: string;
    state: string;
    district: string;
    score: number;
    resolvedIssues?: number;
    totalIssues?: number;
  };
  score: number;
  trend: "UP" | "DOWN" | "STABLE";
  previousRank: number | null;
}

const getTrendIcon = (
  trend: "UP" | "DOWN" | "STABLE",
  previousRank: number | null,
  currentRank: number
) => {
  const change = previousRank ? Math.abs(previousRank - currentRank) : 0;
  if (trend === "UP") {
    return (
      <div className="flex items-center gap-1 text-green-600">
        <TrendingUp className="h-4 w-4" />
        {change > 0 && <span className="text-xs">+{change}</span>}
      </div>
    );
  } else if (trend === "DOWN") {
    return (
      <div className="flex items-center gap-1 text-red-600">
        <TrendingDown className="h-4 w-4" />
        {change > 0 && <span className="text-xs">-{change}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-gray-400">
      <Minus className="h-4 w-4" />
    </div>
  );
};

const getRankBadge = (rank: number) => {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-10 h-10 bg-yellow-100 rounded-full">
        <Trophy className="h-5 w-5 text-yellow-600" />
      </div>
    );
  } else if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-full">
        <Medal className="h-5 w-5 text-gray-500" />
      </div>
    );
  } else if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-10 h-10 bg-amber-100 rounded-full">
        <Medal className="h-5 w-5 text-amber-600" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-10 h-10 bg-muted rounded-full">
      <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
    </div>
  );
};

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
};

const getProgressColor = (score: number) => {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  return "bg-red-500";
};

export default function LeaderboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("month");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalMunicipalities, setTotalMunicipalities] = useState(0);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await municipalitiesApi.getLeaderboard();
        if (result.success && result.data) {
          if (result.data.entries) {
            setLeaderboard(result.data.entries as LeaderboardEntry[]);
            setTotalMunicipalities(result.data.totalMunicipalities || 0);
          } else {
            setLeaderboard([]);
          }
        } else {
          setError(result.error || "Failed to fetch leaderboard");
          setLeaderboard([]);
        }
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
        setError("Network error. Please try again.");
        setLeaderboard([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const filteredLeaderboard = leaderboard.filter(
    (item) =>
      item.municipality.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      item.municipality.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalMunicipalities,
    totalIssuesResolved: leaderboard.reduce(
      (acc, item) => acc + (item.municipality.resolvedIssues || 0),
      0
    ),
    avgScore:
      leaderboard.length > 0
        ? Math.round(
            leaderboard.reduce((acc, item) => acc + item.score, 0) /
              leaderboard.length
          )
        : 0,
    avgResponseTime: 0,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-background py-12">
          <div className="container px-4">
            <div className="text-center space-y-4 mb-8">
              <Badge variant="secondary" className="px-4 py-1">
                <Trophy className="h-3 w-3 mr-1" />
                Municipal Accountability
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold">
                Municipality Leaderboard
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Transparent rankings based on issue resolution rate, response
                time, and citizen satisfaction. Hold your local government
                accountable.
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <MapPin className="h-6 w-6 mx-auto text-primary mb-2" />
                  <div className="text-2xl font-bold">
                    {stats.totalMunicipalities}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Municipalities
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-2" />
                  <div className="text-2xl font-bold">
                    {stats.totalIssuesResolved.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Issues Resolved
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Star className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
                  <div className="text-2xl font-bold">{stats.avgScore}%</div>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Clock className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                  <div className="text-2xl font-bold">
                    {stats.avgResponseTime}h
                  </div>
                  <p className="text-sm text-muted-foreground">Avg Response</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Leaderboard Section */}
        <section className="py-8">
          <div className="container px-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search municipalities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Tabs value={timeRange} onValueChange={setTimeRange}>
                <TabsList>
                  <TabsTrigger value="week">This Week</TabsTrigger>
                  <TabsTrigger value="month">This Month</TabsTrigger>
                  <TabsTrigger value="year">This Year</TabsTrigger>
                  <TabsTrigger value="all">All Time</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Leaderboard Table */}
            <Card>
              <CardHeader>
                <CardTitle>Rankings</CardTitle>
                <CardDescription>
                  Based on resolution rate, response time, and citizen feedback
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array(5)
                      .fill(0)
                      .map((_, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-4 p-4 border rounded-lg"
                        >
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-1/4" />
                          </div>
                          <Skeleton className="h-8 w-16" />
                        </div>
                      ))}
                  </div>
                ) : filteredLeaderboard.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      No results found
                    </h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search query
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredLeaderboard.map((entry) => (
                      <div
                        key={entry.rank}
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        {/* Rank Badge */}
                        <div className="shrink-0">
                          {getRankBadge(entry.rank)}
                        </div>

                        {/* Municipality Info */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">
                              {entry.municipality.name}
                            </h3>
                            {getTrendIcon(
                              entry.trend,
                              entry.previousRank,
                              entry.rank
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{entry.municipality.state}</span>
                          </div>
                          {/* Issue Stats */}
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <div className="flex items-center gap-1.5 text-green-600">
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span className="font-medium">{entry.municipality.resolvedIssues || 0} Closed</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-orange-600">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span className="font-medium">
                                {(entry.municipality.totalIssues || 0) - (entry.municipality.resolvedIssues || 0)} Open
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-blue-600">
                              <Star className="h-3.5 w-3.5" />
                              <span className="font-medium">
                                {entry.municipality.totalIssues ? 
                                  Math.round(((entry.municipality.resolvedIssues || 0) / entry.municipality.totalIssues) * 100) 
                                  : 0}% Resolution
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="text-right shrink-0 w-full sm:w-auto">
                          <div
                            className={`text-2xl font-bold ${getScoreColor(
                              entry.score
                            )}`}
                          >
                            {entry.score}
                          </div>
                          <div className="w-full sm:w-24 mt-1">
                            <Progress value={entry.score} className="h-2" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scoring Explanation */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>How Scores Are Calculated</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <h4 className="font-semibold">Resolution Rate (40%)</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Percentage of reported issues that have been resolved
                      successfully.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <h4 className="font-semibold">Response Time (35%)</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Average time taken to acknowledge and respond to reported
                      issues.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-500" />
                      <h4 className="font-semibold">Quality Score (25%)</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Based on verification of resolution photos and citizen
                      feedback.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
