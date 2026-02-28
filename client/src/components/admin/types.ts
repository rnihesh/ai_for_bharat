export interface AdminStats {
  totalUsers: number;
  totalMunicipalities: number;
  totalIssues: number;
  pendingRegistrations: number;
  issuesByStatus: {
    OPEN: number;
    CLOSED: number;
  };
  // Enhanced analytics
  issuesByType?: Record<string, number>;
  topMunicipalities?: Array<{
    id: string;
    name: string;
    issueCount: number;
  }>;
  issuesTrend?: Array<{
    date: string;
    count: number;
    label: string;
  }>;
  issuesTrend30Days?: Array<{
    date: string;
    count: number;
  }>;
  resolutionRate?: number;
  avgResolutionTimeHours?: number;
  mlServiceStatus?: "healthy" | "unhealthy" | "offline" | "unknown";
}

export interface Municipality {
  id: string;
  name: string;
  type: string;
  state: string;
  district: string;
  score: number;
  totalIssues: number;
  resolvedIssues: number;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface Issue {
  id: string;
  type: string;
  description: string;
  status: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  imageUrls?: string[];
  createdAt: string;
  reportedBy: string;
}

export interface Registration {
  id: string;
  name: string;
  email: string;
  municipalityName: string;
  state: string;
  district: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  municipalityId?: string;
  createdAt: string;
}

export const ISSUE_TYPES = [
  "POTHOLE",
  "GARBAGE",
  "GRAFFITI",
  "ILLEGAL_PARKING",
  "DEAD_ANIMAL",
  "FALLEN_TREE",
  "DAMAGED_ROAD_SIGN",
  "DAMAGED_ELECTRICAL_POLE",
  "DAMAGED_CONCRETE",
  "OTHER",
] as const;

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const MUNICIPALITY_TYPES = [
  { value: "MUNICIPAL_CORPORATION", label: "Municipal Corporation" },
  { value: "MUNICIPALITY", label: "Municipality" },
  { value: "NAGAR_PANCHAYAT", label: "Nagar Panchayat" },
  { value: "GRAM_PANCHAYAT", label: "Gram Panchayat" },
  { value: "CANTONMENT_BOARD", label: "Cantonment Board" },
] as const;
