import { z } from "zod";

// ============================================
// CONSTANTS
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

export const ISSUE_STATUS = ["OPEN", "CLOSED"] as const;

export const MUNICIPALITY_TYPES = [
  "MUNICIPAL_CORPORATION",
  "MUNICIPALITY",
  "NAGAR_PANCHAYAT",
  "GRAM_PANCHAYAT",
  "CANTONMENT_BOARD",
] as const;

export const USER_ROLES = [
  "CITIZEN",
  "MUNICIPALITY_USER",
  "PLATFORM_MAINTAINER",
] as const;

// ============================================
// BASE SCHEMAS
// ============================================

export const geoLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const administrativeRegionSchema = z.object({
  state: z.string().min(1).max(100),
  district: z.string().min(1).max(100),
  municipality: z.string().min(1).max(100),
  ward: z.string().max(50).optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

export const boundsSchema = z.object({
  north: z.number().min(-90).max(90),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  west: z.number().min(-180).max(180),
});

// ============================================
// ISSUE SCHEMAS
// ============================================

export const issueTypeSchema = z.enum(ISSUE_TYPES);
export const issueStatusSchema = z.enum(ISSUE_STATUS);

export const resolutionMetadataSchema = z.object({
  resolutionImageUrl: z.string().url(),
  resolutionNote: z.string().min(10).max(1000),
  respondedAt: z.coerce.date(),
  respondedBy: z.string().min(1),
  verificationScore: z.number().min(0).max(1).nullable(),
  verifiedAt: z.coerce.date().nullable(),
});

export const issueSchema = z.object({
  id: z.string().min(1),
  type: issueTypeSchema,
  description: z.string().min(10).max(500),
  imageUrl: z.string().url().nullable(),
  location: geoLocationSchema,
  region: administrativeRegionSchema,
  municipalityId: z.string().min(1),
  status: issueStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  resolution: resolutionMetadataSchema.nullable(),
});

export const createIssueInputSchema = z.object({
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must be less than 500 characters"),
  imageUrl: z.string().url("Invalid image URL").optional(),
  location: geoLocationSchema,
  type: issueTypeSchema.optional(),
});

export const respondToIssueInputSchema = z.object({
  issueId: z.string().min(1),
  resolutionImageUrl: z.string().url("Invalid resolution image URL"),
  resolutionNote: z
    .string()
    .min(10, "Resolution note must be at least 10 characters")
    .max(1000, "Resolution note must be less than 1000 characters"),
});

// Helper to handle query params that can be string or string[]
const stringOrArraySchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.union([
    z.array(itemSchema),
    itemSchema.transform((val) => [val]),
  ]).optional();

export const issueFiltersSchema = z.object({
  status: stringOrArraySchema(issueStatusSchema),
  type: stringOrArraySchema(issueTypeSchema),
  municipalityId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  bounds: boundsSchema.optional(),
});

// ============================================
// MUNICIPALITY SCHEMAS
// ============================================

export const municipalityTypeSchema = z.enum(MUNICIPALITY_TYPES);

export const municipalitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  type: municipalityTypeSchema,
  state: z.string().min(1).max(100),
  district: z.string().min(1).max(100),
  score: z.number().int(),
  totalIssues: z.number().int().min(0),
  resolvedIssues: z.number().int().min(0),
  avgResolutionTime: z.number().min(0).nullable(),
  bounds: boundsSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Municipality registration request input (pending approval)
export const municipalityRegistrationSchema = z.object({
  // User details
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(15),

  // Municipality details
  municipalityName: z
    .string()
    .min(3, "Municipality name must be at least 3 characters")
    .max(200),
  municipalityType: municipalityTypeSchema,
  state: z.string().min(1, "State is required").max(100),
  district: z.string().min(1, "District is required").max(100),
  address: z
    .string()
    .min(10, "Address must be at least 10 characters")
    .max(500),
  population: z.number().int().min(0).optional(),

  // Location bounds for jurisdiction
  bounds: boundsSchema.optional(),

  // Verification
  registrationNumber: z
    .string()
    .min(3, "Registration number is required")
    .max(100),

  // Note: status and rejectionReason are server-controlled, not in input schema
});

// Create municipality (admin only)
export const createMunicipalitySchema = z.object({
  name: z.string().min(3).max(200),
  type: municipalityTypeSchema,
  state: z.string().min(1).max(100),
  district: z.string().min(1).max(100),
  bounds: boundsSchema,
});

// Update municipality (admin only)
export const updateMunicipalitySchema = z.object({
  name: z.string().min(3).max(200).optional(),
  type: municipalityTypeSchema.optional(),
  state: z.string().min(1).max(100).optional(),
  district: z.string().min(1).max(100).optional(),
  bounds: boundsSchema.optional(),
});

// ============================================
// USER SCHEMAS
// ============================================

export const userRoleSchema = z.enum(USER_ROLES);

export const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  role: userRoleSchema,
  municipalityId: z.string().nullable(),
  displayName: z.string().min(1).max(100),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  lastLoginAt: z.coerce.date().nullable(),
});

export const loginInputSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// ============================================
// VERIFICATION SCHEMAS
// ============================================

export const classificationResultSchema = z.object({
  type: issueTypeSchema,
  confidence: z.number().min(0).max(1),
  alternatives: z.array(
    z.object({
      type: issueTypeSchema,
      confidence: z.number().min(0).max(1),
    })
  ),
});

export const verificationResultSchema = z.object({
  isResolved: z.boolean(),
  confidence: z.number().min(0).max(1),
  factors: z.object({
    imageSimilarity: z.number().min(0).max(1),
    cleanlinessScore: z.number().min(0).max(1),
    structuralChange: z.number().min(0).max(1),
  }),
  explanation: z.string(),
});

// ============================================
// API SCHEMAS
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type GeoLocation = z.infer<typeof geoLocationSchema>;
export type GeoPoint = z.infer<typeof geoPointSchema>;
export type AdministrativeRegion = z.infer<typeof administrativeRegionSchema>;
export type Bounds = z.infer<typeof boundsSchema>;
export type IssueType = z.infer<typeof issueTypeSchema>;
export type IssueStatus = z.infer<typeof issueStatusSchema>;
export type ResolutionMetadata = z.infer<typeof resolutionMetadataSchema>;
export type Issue = z.infer<typeof issueSchema>;
export type CreateIssueInput = z.infer<typeof createIssueInputSchema>;
export type RespondToIssueInput = z.infer<typeof respondToIssueInputSchema>;
export type IssueFilters = z.infer<typeof issueFiltersSchema>;
export type MunicipalityType = z.infer<typeof municipalityTypeSchema>;
export type Municipality = z.infer<typeof municipalitySchema>;
export type MunicipalityRegistration = z.infer<
  typeof municipalityRegistrationSchema
>;
export type CreateMunicipality = z.infer<typeof createMunicipalitySchema>;
export type UpdateMunicipality = z.infer<typeof updateMunicipalitySchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type User = z.infer<typeof userSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type ClassificationResult = z.infer<typeof classificationResultSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
