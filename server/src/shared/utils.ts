import {
  differenceInDays,
  differenceInMonths,
  format,
  formatDistanceToNow,
} from "date-fns";
import type {
  Issue,
  IssueStatus,
  IssueType,
  Municipality,
} from "./types";

// ============================================
// SCORING CONSTANTS
// ============================================

export const SCORING_CONFIG = {
  BASE_SCORE: 10000,
  VERIFICATION_BONUS: 10,
  PENALTIES: {
    MONTH_1: 200, // Days 31-60
    MONTH_2: 300, // Days 61-90
    MONTH_3_PLUS: 500, // Days 90+
  },
  VERIFICATION_THRESHOLD: 0.75,
} as const;

// ============================================
// SCORE CALCULATION
// ============================================

export function calculatePenalty(daysOpen: number): number {
  if (daysOpen <= 30) return 0;
  if (daysOpen <= 60) return SCORING_CONFIG.PENALTIES.MONTH_1;
  if (daysOpen <= 90) return SCORING_CONFIG.PENALTIES.MONTH_2;

  // For 90+ days, calculate cumulative penalty
  const monthsBeyond90 = Math.ceil((daysOpen - 90) / 30);
  return (
    SCORING_CONFIG.PENALTIES.MONTH_1 +
    SCORING_CONFIG.PENALTIES.MONTH_2 +
    monthsBeyond90 * SCORING_CONFIG.PENALTIES.MONTH_3_PLUS
  );
}

export function calculateMunicipalityScore(
  openIssues: Array<{ createdAt: Date; id: string }>,
  verifiedCount: number,
  currentDate: Date = new Date()
): {
  score: number;
  penalties: Array<{ issueId: string; daysOpen: number; penalty: number }>;
  bonuses: number;
} {
  let score = SCORING_CONFIG.BASE_SCORE;
  const penalties: Array<{
    issueId: string;
    daysOpen: number;
    penalty: number;
  }> = [];

  // Calculate penalties for open issues
  for (const issue of openIssues) {
    const daysOpen = differenceInDays(currentDate, issue.createdAt);
    const penalty = calculatePenalty(daysOpen);

    if (penalty > 0) {
      penalties.push({
        issueId: issue.id,
        daysOpen,
        penalty,
      });
      score -= penalty;
    }
  }

  // Add bonuses for verified issues
  const bonuses = verifiedCount * SCORING_CONFIG.VERIFICATION_BONUS;
  score += bonuses;

  return {
    score: Math.max(0, score), // Score can't go negative
    penalties,
    bonuses,
  };
}

// ============================================
// GEOLOCATION UTILITIES
// ============================================

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function isPointInBounds(
  lat: number,
  lng: number,
  bounds: { north: number; south: number; east: number; west: number }
): boolean {
  return (
    lat <= bounds.north &&
    lat >= bounds.south &&
    lng <= bounds.east &&
    lng >= bounds.west
  );
}

export function getBoundsCenter(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): {
  lat: number;
  lng: number;
} {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}

// ============================================
// DATE UTILITIES
// ============================================

export function formatDate(date: Date): string {
  return format(date, "dd MMM yyyy");
}

export function formatDateTime(date: Date): string {
  return format(date, "dd MMM yyyy, HH:mm");
}

export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

export function getDaysOpen(createdAt: Date): number {
  return differenceInDays(new Date(), createdAt);
}

export function getMonthsOpen(createdAt: Date): number {
  return differenceInMonths(new Date(), createdAt);
}

// ============================================
// ID GENERATION
// ============================================

export function generateIssueId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `ISS-${timestamp}-${randomPart}`.toUpperCase();
}

export function generateMunicipalityId(
  state: string,
  district: string,
  name: string
): string {
  const sanitize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `MUN-${sanitize(state).slice(0, 3)}-${sanitize(district).slice(
    0,
    3
  )}-${sanitize(name).slice(0, 6)}`.toUpperCase();
}

// ============================================
// STATUS UTILITIES
// ============================================

export function getStatusColor(status: IssueStatus): string {
  const colors: Record<IssueStatus, string> = {
    OPEN: "red",
    CLOSED: "green",
  };
  return colors[status];
}

export function getStatusLabel(status: IssueStatus): string {
  const labels: Record<IssueStatus, string> = {
    OPEN: "Open",
    CLOSED: "Closed",
  };
  return labels[status];
}

export function getIssueTypeLabel(type: IssueType): string {
  const labels: Record<IssueType, string> = {
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
  return labels[type];
}

export function getIssueTypeIcon(type: IssueType): string {
  const icons: Record<IssueType, string> = {
    POTHOLE: "🕳️",
    GARBAGE: "🗑️",
    ILLEGAL_PARKING: "🅿️",
    DAMAGED_SIGN: "🚧",
    FALLEN_TREE: "🌳",
    VANDALISM: "🎨",
    DEAD_ANIMAL: "🦴",
    DAMAGED_CONCRETE: "🏗️",
    DAMAGED_ELECTRICAL: "⚡",
  };
  return icons[type];
}

// ============================================
// FORMATTING UTILITIES
// ============================================

export function formatScore(score: number): string {
  return new Intl.NumberFormat("en-IN").format(score);
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// ============================================
// VERIFICATION UTILITIES
// ============================================

export function shouldAutoVerify(confidenceScore: number): boolean {
  return confidenceScore >= SCORING_CONFIG.VERIFICATION_THRESHOLD;
}

export function getVerificationStatus(
  confidenceScore: number | null
): IssueStatus {
  // Always return CLOSED when there's a response/resolution
  return "CLOSED";
}

// ============================================
// ARRAY UTILITIES
// ============================================

export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

export function sortByKey<T>(
  array: T[],
  key: keyof T,
  order: "asc" | "desc" = "asc"
): T[] {
  return [...array].sort((a, b) => {
    if (a[key] < b[key]) return order === "asc" ? -1 : 1;
    if (a[key] > b[key]) return order === "asc" ? 1 : -1;
    return 0;
  });
}
