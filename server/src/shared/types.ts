// ============================================
// ISSUE TYPES (Aligned with ML Classifier)
// ============================================

export const ISSUE_TYPES = [
  "POTHOLE", // Potholes and Road Damage
  "GARBAGE", // Littering/Garbage on Public Places
  "ILLEGAL_PARKING", // Illegal Parking Issues
  "DAMAGED_SIGN", // Broken Road Sign Issues
  "FALLEN_TREE", // Fallen trees
  "VANDALISM", // Vandalism Issues (Graffiti)
  "DEAD_ANIMAL", // Dead Animal Pollution
  "DAMAGED_CONCRETE", // Damaged concrete structures
  "DAMAGED_ELECTRICAL", // Damaged Electric wires and poles
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

// ML Class name to Issue Type mapping
export const ML_CLASS_TO_ISSUE_TYPE: Record<string, IssueType> = {
  "Potholes and Road Damage": "POTHOLE",
  Littering: "GARBAGE",
  "Illegal Parking Issues": "ILLEGAL_PARKING",
  "Broken Road Sign Issues": "DAMAGED_SIGN",
  "Fallen trees": "FALLEN_TREE",
  "Vandalism Issues": "VANDALISM",
  "Dead Animal Pollution": "DEAD_ANIMAL",
  "Damaged concrete structures": "DAMAGED_CONCRETE",
  "Damaged Electric wires and poles": "DAMAGED_ELECTRICAL",
};

// Issue Type to display label mapping
export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  POTHOLE: "Potholes & Road Damage",
  GARBAGE: "Littering/Garbage",
  ILLEGAL_PARKING: "Illegal Parking",
  DAMAGED_SIGN: "Broken Road Signs",
  FALLEN_TREE: "Fallen Trees",
  VANDALISM: "Vandalism/Graffiti",
  DEAD_ANIMAL: "Dead Animal Pollution",
  DAMAGED_CONCRETE: "Damaged Concrete Structures",
  DAMAGED_ELECTRICAL: "Damaged Electric Poles/Wires",
};

export const ISSUE_STATUS = ["OPEN", "CLOSED"] as const;

export type IssueStatus = (typeof ISSUE_STATUS)[number];

// ============================================
// GEOGRAPHIC TYPES
// ============================================

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface AdministrativeRegion {
  state: string;
  district: string;
  municipality: string;
  ward?: string;
  pincode?: string;
}

// ============================================
// RESOLUTION TYPES
// ============================================

export interface ResolutionMetadata {
  resolutionImageUrl: string;
  resolutionNote: string;
  respondedAt: Date;
  respondedBy: string;
  verificationScore: number | null;
  verifiedAt: Date | null;
}

// ============================================
// ISSUE ENTITY
// ============================================

export interface Issue {
  id: string;
  type: IssueType;
  description: string;
  imageUrl: string | null;
  imageUrls?: string[];
  location: GeoLocation;
  region: AdministrativeRegion;
  municipalityId: string;
  municipalityResponse?: string;
  status: IssueStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolution: ResolutionMetadata | null;
}

export interface CreateIssueInput {
  description: string;
  imageUrl: string;
  location: GeoLocation;
  type?: IssueType;
}

export interface RespondToIssueInput {
  issueId: string;
  resolutionImageUrl: string;
  resolutionNote: string;
}

// ============================================
// MUNICIPALITY TYPES
// ============================================

export const MUNICIPALITY_TYPES = [
  "MUNICIPAL_CORPORATION",
  "MUNICIPALITY",
  "NAGAR_PANCHAYAT",
  "GRAM_PANCHAYAT",
  "CANTONMENT_BOARD",
] as const;

export type MunicipalityType = (typeof MUNICIPALITY_TYPES)[number];

export interface Municipality {
  id: string;
  name: string;
  type: MunicipalityType;
  state: string;
  district: string;
  score: number;
  totalIssues: number;
  resolvedIssues: number;
  avgResolutionTime: number | null; // in hours
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface MunicipalityStats {
  municipalityId: string;
  totalIssues: number;
  openIssues: number;
  closedIssues: number;
  avgResolutionTimeHours: number | null;
  issuesByType: Record<IssueType, number>;
  monthlyTrend: Array<{
    month: string;
    issues: number;
    resolved: number;
  }>;
}

// ============================================
// USER TYPES
// ============================================

export const USER_ROLES = [
  "USER",
  "MUNICIPALITY_USER",
  "PLATFORM_MAINTAINER",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: string;
  email: string;
  role: UserRole;
  municipalityId: string | null;
  displayName: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface MunicipalityUser extends User {
  role: "MUNICIPALITY_USER";
  municipalityId: string;
}

// ============================================
// SCORING TYPES
// ============================================

export interface ScoreCalculation {
  municipalityId: string;
  baseScore: number;
  penalties: Array<{
    issueId: string;
    daysOpen: number;
    penalty: number;
  }>;
  bonuses: Array<{
    issueId: string;
    bonus: number;
    reason: string;
  }>;
  finalScore: number;
  calculatedAt: Date;
}

// ============================================
// ML/VERIFICATION TYPES
// ============================================

export interface ClassificationResult {
  type: IssueType;
  confidence: number;
  alternatives: Array<{
    type: IssueType;
    confidence: number;
  }>;
}

export interface VerificationResult {
  isResolved: boolean;
  confidence: number;
  factors: {
    imageSimilarity: number;
    cleanlinessScore: number;
    structuralChange: number;
  };
  explanation: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface IssueFilters {
  status?: IssueStatus[];
  type?: IssueType[];
  municipalityId?: string;
  startDate?: Date;
  endDate?: Date;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

// ============================================
// LEADERBOARD TYPES
// ============================================

export interface LeaderboardEntry {
  rank: number;
  municipality: Municipality;
  score: number;
  trend: "UP" | "DOWN" | "STABLE";
  previousRank: number | null;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  lastUpdated: Date;
  totalMunicipalities: number;
}

// ============================================
// ML CLUSTERING TYPES
// ============================================

export interface IssueCluster {
  id: string;
  centroid: GeoLocation;
  issueCount: number;
  aggregateSeverity: number;
  severityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  dominantType: IssueType | null;
  typeCounts: Record<string, number>;
  radiusMeters: number;
  issueIds: string[];
}

export interface ClusteringResult {
  clusters: IssueCluster[];
  unclustered: Issue[];
  statistics: {
    totalIssues: number;
    clusteredCount: number;
    unclusteredCount: number;
    clusterCount: number;
    avgClusterSize: number;
  };
}

// ============================================
// ML SEVERITY TYPES
// ============================================

export interface SeverityPrediction {
  score: number; // 1-10
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  factors: string[];
  mlScore?: number;
  ruleScore?: number;
}

// ============================================
// ML RISK TYPES
// ============================================

export interface RiskPrediction {
  riskScore: number; // 0-1
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  factors: string[];
  location: GeoLocation;
  weather: {
    rainfall_mm: number;
    temperature_c: number;
    humidity_pct: number;
    is_monsoon: boolean;
  };
}

export interface RiskGridPrediction {
  latitude: number;
  longitude: number;
  riskScore: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface RiskGridResult {
  predictions: RiskGridPrediction[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  gridSize: number;
}
