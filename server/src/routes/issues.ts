import { Router, Request, Response } from "express";
import type { Router as IRouter } from "express";
import { getAdminDb, COLLECTIONS } from "../shared/firebase";
import {
  createIssueInputSchema,
  respondToIssueInputSchema,
  issueFiltersSchema,
  paginationSchema,
} from "../shared/validation";
import { generateIssueId, calculateMunicipalityScore } from "../shared/utils";
import {
  authMiddleware,
  requireRole,
  requireMunicipality,
  AuthenticatedRequest,
} from "../middleware/auth";
import {
  findMunicipalityForLocation,
  getAdministrativeRegion,
  classifyIssueWithGemini,
} from "../services/location";
import type { Issue, IssueStatus, GeoLocation } from "../shared/types";

const router: IRouter = Router();

// Helper function to recalculate municipality score
async function recalculateMunicipalityScore(municipalityId: string) {
  const db = getAdminDb();

  // Get all open issues for this municipality
  const openIssuesSnapshot = await db
    .collection(COLLECTIONS.ISSUES)
    .where("municipalityId", "==", municipalityId)
    .where("status", "==", "OPEN")
    .get();

  const openIssues = openIssuesSnapshot.docs.map((doc) => ({
    id: doc.id,
    createdAt:
      doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
  }));

  // Get count of closed issues (for bonus)
  const closedIssuesSnapshot = await db
    .collection(COLLECTIONS.ISSUES)
    .where("municipalityId", "==", municipalityId)
    .where("status", "==", "CLOSED")
    .count()
    .get();

  const closedCount = closedIssuesSnapshot.data().count;

  // Calculate new score
  const { score } = calculateMunicipalityScore(openIssues, closedCount);

  // Update municipality score
  await db.collection(COLLECTIONS.MUNICIPALITIES).doc(municipalityId).update({
    score,
    updatedAt: new Date(),
  });

  return score;
}

// Get all issues (public)
router.get("/", async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    const { page, pageSize } = paginationSchema.parse(req.query);
    const filters = issueFiltersSchema.parse(req.query);

    const hasStatusFilter = filters.status && filters.status.length > 0;
    const hasTypeFilter = filters.type && filters.type.length > 0;
    
    // Due to Firestore composite index requirements, we'll fetch all and filter in memory
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.ISSUES)
      .orderBy("createdAt", "desc");
    
    if (filters.municipalityId) {
      query = query.where("municipalityId", "==", filters.municipalityId);
    }

    // Fetch a larger batch to allow for filtering
    const snapshot = await query.limit(500).get();

    let issues = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as any[];
    
    // Apply filters in memory
    if (hasStatusFilter) {
      issues = issues.filter((issue) => filters.status!.includes(issue.status));
    }
    
    if (hasTypeFilter) {
      issues = issues.filter((issue) => filters.type!.includes(issue.type));
    }

    // Get total count for the filtered results
    const total = issues.length;
    
    // Apply pagination
    const offset = (page - 1) * pageSize;
    const paginatedIssues = issues.slice(offset, offset + pageSize);

    res.json({
      success: true,
      data: {
        items: paginatedIssues,
        total,
        page,
        pageSize,
        hasMore: offset + paginatedIssues.length < total,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching issues:", error?.message || String(error));
    console.error("Full error:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch issues: " + (error?.message || String(error)),
      timestamp: new Date().toISOString(),
    });
  }
});

// Get global stats (public) - must be before /:id to avoid route conflicts
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const db = getAdminDb();

    // Get total issues count
    const totalSnapshot = await db.collection(COLLECTIONS.ISSUES).count().get();
    const totalIssues = totalSnapshot.data().count;

    // Get resolved issues count (CLOSED status)
    const resolvedSnapshot = await db
      .collection(COLLECTIONS.ISSUES)
      .where("status", "==", "CLOSED")
      .count()
      .get();
    const resolvedIssues = resolvedSnapshot.data().count;

    // Get municipalities count
    const municipalitiesSnapshot = await db
      .collection(COLLECTIONS.MUNICIPALITIES)
      .count()
      .get();
    const totalMunicipalities = municipalitiesSnapshot.data().count;

    res.json({
      success: true,
      data: {
        totalIssues,
        resolvedIssues,
        openIssues: totalIssues - resolvedIssues,
        totalMunicipalities,
        avgResponseTime: 48, // This would need more complex calculation
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(
      "Error fetching global stats:",
      error?.message || String(error)
    );
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch stats",
      timestamp: new Date().toISOString(),
    });
  }
});

// Get single issue (public)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    const doc = await db
      .collection(COLLECTIONS.ISSUES)
      .doc(req.params.id)
      .get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        data: null,
        error: "Issue not found",
        timestamp: new Date().toISOString(),
      });
    }

    const issue = {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data()?.createdAt?.toDate(),
      updatedAt: doc.data()?.updatedAt?.toDate(),
    };

    res.json({
      success: true,
      data: issue,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching issue:", error?.message || String(error));
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch issue",
      timestamp: new Date().toISOString(),
    });
  }
});

// Get issues by bounds (for map)
router.get("/map/bounds", async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    const { north, south, east, west } = req.query;

    if (!north || !south || !east || !west) {
      return res.status(400).json({
        success: false,
        data: null,
        error: "Missing bounds parameters",
        timestamp: new Date().toISOString(),
      });
    }

    const snapshot = await db
      .collection(COLLECTIONS.ISSUES)
      .where("location.latitude", ">=", parseFloat(south as string))
      .where("location.latitude", "<=", parseFloat(north as string))
      .limit(500)
      .get();

    const issues = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((issue) => {
        const lng = (issue as any).location?.longitude;
        return (
          lng >= parseFloat(west as string) && lng <= parseFloat(east as string)
        );
      });

    res.json({
      success: true,
      data: issues,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(
      "Error fetching map issues:",
      error?.message || String(error)
    );
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch map issues",
      timestamp: new Date().toISOString(),
    });
  }
});

// Create new issue (anonymous/public)
router.post("/", async (req: Request, res: Response) => {
  try {
    const input = createIssueInputSchema.parse(req.body);
    const db = getAdminDb();

    const issueId = generateIssueId();
    const now = new Date();

    const { latitude, longitude } = input.location;

    // Classify issue type using Gemini (if type not provided)
    let classifiedType: Issue["type"] = input.type || "POTHOLE";
    if (!input.type) {
      try {
        const classification = await classifyIssueWithGemini(input.description);
        if (classification && classification.confidence > 0.7) {
          classifiedType = classification.type as Issue["type"];
          console.log(
            `Issue classified as ${classifiedType} with confidence ${classification.confidence}`
          );
        }
      } catch (err) {
        console.warn("Issue classification failed, using default type:", err);
      }
    }

    // Find the appropriate municipality based on location first
    let municipalityId = "MUN-DEFAULT";
    let municipalityData: {
      name?: string;
      district?: string;
      state?: string;
    } | null = null;
    try {
      const municipalityMatch = await findMunicipalityForLocation(
        latitude,
        longitude,
        db
      );
      if (municipalityMatch) {
        municipalityId = municipalityMatch.municipalityId;
        console.log(
          `Issue assigned to municipality ${municipalityMatch.name} (${municipalityMatch.matchType})`
        );

        // Get municipality data for region fallback
        const muniDoc = await db
          .collection(COLLECTIONS.MUNICIPALITIES)
          .doc(municipalityId)
          .get();
        if (muniDoc.exists) {
          const data = muniDoc.data();
          municipalityData = {
            name: data?.name || municipalityMatch.name,
            district: data?.district,
            state: data?.state,
          };
        }
      }
    } catch (err) {
      console.warn("Failed to find municipality for location:", err);
    }

    // Get administrative region from coordinates
    let region = {
      state: "Unknown",
      district: "Unknown",
      municipality: "Unknown",
    };

    try {
      const adminRegion = await getAdministrativeRegion(latitude, longitude);
      if (adminRegion && adminRegion.state) {
        region = {
          state: adminRegion.state || "Unknown",
          district: adminRegion.district || "Unknown",
          municipality: adminRegion.municipality || "Unknown",
          ...(adminRegion.pincode && { pincode: adminRegion.pincode }),
        };
      } else if (municipalityData) {
        // Fallback to municipality data if geocoding failed
        console.log("Using municipality data as fallback for region");
        region = {
          state: municipalityData.state || "Unknown",
          district: municipalityData.district || "Unknown",
          municipality: municipalityData.name || "Unknown",
        };
      }
    } catch (err) {
      console.warn("Failed to get administrative region:", err);
      // Use municipality data as fallback
      if (municipalityData) {
        region = {
          state: municipalityData.state || "Unknown",
          district: municipalityData.district || "Unknown",
          municipality: municipalityData.name || "Unknown",
        };
      }
    }

    const location: GeoLocation = {
      latitude,
      longitude,
    };

    // Support both single imageUrl and imageUrls array
    const imageUrls =
      req.body.imageUrls || (input.imageUrl ? [input.imageUrl] : []);

    const issue: Omit<Issue, "id"> = {
      type: classifiedType,
      description: input.description,
      imageUrl: input.imageUrl || (imageUrls.length > 0 ? imageUrls[0] : null),
      imageUrls: imageUrls,
      location,
      region,
      municipalityId,
      status: "OPEN" as IssueStatus,
      createdAt: now,
      updatedAt: now,
      resolution: null,
    };

    await db
      .collection(COLLECTIONS.ISSUES)
      .doc(issueId)
      .set({
        ...issue,
        createdAt: now,
        updatedAt: now,
      });

    // Update municipality stats
    await db
      .collection(COLLECTIONS.MUNICIPALITIES)
      .doc(municipalityId)
      .update({
        totalIssues:
          require("firebase-admin").firestore.FieldValue.increment(1),
        updatedAt: now,
      })
      .catch(() => {
        // Municipality might not exist yet
      });

    // Recalculate municipality score (new issue might affect penalties)
    await recalculateMunicipalityScore(municipalityId).catch(() => {
      // Score calculation might fail if municipality doesn't exist
    });

    res.status(201).json({
      success: true,
      data: { id: issueId, ...issue },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error creating issue:", error?.message || error);

    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        data: null,
        error:
          "Validation failed: " +
          error.errors.map((e: any) => e.message).join(", "),
        timestamp: new Date().toISOString(),
      });
    }

    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to create issue",
      timestamp: new Date().toISOString(),
    });
  }
});

// Respond to issue (municipality user only)
router.post(
  "/:id/respond",
  authMiddleware,
  requireRole("MUNICIPALITY_USER"),
  requireMunicipality,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const {
        response: responseText,
        resolutionImageUrl,
        resolutionNote,
      } = req.body;

      if (!responseText && !resolutionNote) {
        return res.status(400).json({
          success: false,
          data: null,
          error: "Response text is required",
          timestamp: new Date().toISOString(),
        });
      }

      const db = getAdminDb();

      // Get the issue
      const issueDoc = await db.collection(COLLECTIONS.ISSUES).doc(id).get();

      if (!issueDoc.exists) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Issue not found",
          timestamp: new Date().toISOString(),
        });
      }

      const issue = issueDoc.data() as Issue;

      // Check jurisdiction
      if (issue.municipalityId !== req.user?.municipalityId) {
        return res.status(403).json({
          success: false,
          data: null,
          error: "Issue not in your jurisdiction",
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date();

      await db
        .collection(COLLECTIONS.ISSUES)
        .doc(id)
        .update({
          status: "CLOSED",
          municipalityResponse: responseText || resolutionNote,
          resolution: {
            resolutionImageUrl: resolutionImageUrl || null,
            resolutionNote: responseText || resolutionNote,
            respondedAt: now,
            respondedBy: req.user?.uid,
            verificationScore: null,
            verifiedAt: null,
          },
          resolvedAt: now,
          updatedAt: now,
        });

      // Update municipality resolved issues counter and recalculate score
      if (issue.status === "OPEN" && issue.municipalityId) {
        const muniRef = db
          .collection(COLLECTIONS.MUNICIPALITIES)
          .doc(issue.municipalityId);
        const muniDoc = await muniRef.get();
        if (muniDoc.exists) {
          const muniData = muniDoc.data();
          await muniRef.update({
            resolvedIssues: (muniData?.resolvedIssues || 0) + 1,
            updatedAt: now,
          });

          // Recalculate municipality score
          await recalculateMunicipalityScore(issue.municipalityId);
        }
      }

      res.json({
        success: true,
        data: {
          issueId: id,
          status: "CLOSED",
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error(
        "Error responding to issue:",
        error?.message || String(error)
      );

      if (error.name === "ZodError") {
        return res.status(400).json({
          success: false,
          data: null,
          error:
            "Validation failed: " +
            error.errors.map((e: any) => e.message).join(", "),
          timestamp: new Date().toISOString(),
        });
      }

      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to respond to issue",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Update issue status (municipality user only)
router.patch(
  "/:id/status",
  authMiddleware,
  requireRole("MUNICIPALITY_USER"),
  requireMunicipality,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ["OPEN", "CLOSED"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          data: null,
          error: "Invalid status. Must be one of: " + validStatuses.join(", "),
          timestamp: new Date().toISOString(),
        });
      }

      const db = getAdminDb();

      // Get the issue
      const issueDoc = await db.collection(COLLECTIONS.ISSUES).doc(id).get();

      if (!issueDoc.exists) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Issue not found",
          timestamp: new Date().toISOString(),
        });
      }

      const issue = issueDoc.data() as Issue;

      // Check jurisdiction
      if (issue.municipalityId !== req.user?.municipalityId) {
        return res.status(403).json({
          success: false,
          data: null,
          error: "Issue not in your jurisdiction",
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date();

      await db
        .collection(COLLECTIONS.ISSUES)
        .doc(id)
        .update({
          status,
          updatedAt: now,
          ...(status === "CLOSED" ? { resolvedAt: now } : {}),
        });

      // Update municipality stats if resolved (CLOSED)
      if (status === "CLOSED" && issue.municipalityId) {
        const muniRef = db
          .collection(COLLECTIONS.MUNICIPALITIES)
          .doc(issue.municipalityId);
        const muniDoc = await muniRef.get();
        if (muniDoc.exists) {
          const muniData = muniDoc.data();
          await muniRef.update({
            resolvedIssues: (muniData?.resolvedIssues || 0) + 1,
            updatedAt: now,
          });
        }
      }

      res.json({
        success: true,
        data: { issueId: id, status },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error(
        "Error updating issue status:",
        error?.message || String(error)
      );
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to update issue status",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Recalculate all municipality scores (admin utility endpoint)
router.post("/recalculate-scores", async (_req: Request, res: Response) => {
  try {
    const db = getAdminDb();

    // Get all municipalities
    const municipalitiesSnapshot = await db
      .collection(COLLECTIONS.MUNICIPALITIES)
      .get();

    const results: {
      municipalityId: string;
      name: string;
      oldScore: number;
      newScore: number;
    }[] = [];

    for (const doc of municipalitiesSnapshot.docs) {
      const muniData = doc.data();
      const oldScore = muniData.score || 0;

      try {
        // Also recalculate totalIssues and resolvedIssues from actual issues
        const allIssuesSnapshot = await db
          .collection(COLLECTIONS.ISSUES)
          .where("municipalityId", "==", doc.id)
          .get();

        const closedIssuesSnapshot = await db
          .collection(COLLECTIONS.ISSUES)
          .where("municipalityId", "==", doc.id)
          .where("status", "==", "CLOSED")
          .count()
          .get();

        const totalIssues = allIssuesSnapshot.size;
        const resolvedIssues = closedIssuesSnapshot.data().count;

        // Update municipality with correct counts
        await db.collection(COLLECTIONS.MUNICIPALITIES).doc(doc.id).update({
          totalIssues,
          resolvedIssues,
          updatedAt: new Date(),
        });

        const newScore = await recalculateMunicipalityScore(doc.id);
        results.push({
          municipalityId: doc.id,
          name: muniData.name,
          oldScore,
          newScore,
        });
      } catch (err) {
        console.error(`Failed to recalculate score for ${doc.id}:`, err);
      }
    }

    res.json({
      success: true,
      data: {
        updated: results.length,
        results,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(
      "Error recalculating scores:",
      error?.message || String(error)
    );
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to recalculate scores",
      timestamp: new Date().toISOString(),
    });
  }
});

// Delete an issue (admin only)
router.delete(
  "/:issueId",
  authMiddleware,
  requireRole("PLATFORM_MAINTAINER"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();
      const { issueId } = req.params;

      // Get the issue first
      const issueRef = db.collection(COLLECTIONS.ISSUES).doc(issueId);
      const issueDoc = await issueRef.get();

      if (!issueDoc.exists) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Issue not found",
          timestamp: new Date().toISOString(),
        });
      }

      const issueData = issueDoc.data();
      const municipalityId = issueData?.municipalityId;

      // Delete the issue
      await issueRef.delete();

      // Update municipality stats if applicable
      if (municipalityId) {
        const municipalityRef = db
          .collection(COLLECTIONS.MUNICIPALITIES)
          .doc(municipalityId);
        const municipalityDoc = await municipalityRef.get();

        if (municipalityDoc.exists) {
          const muniData = municipalityDoc.data();
          const totalIssues = Math.max(0, (muniData?.totalIssues || 1) - 1);
          const resolvedIssues =
            issueData?.status === "CLOSED"
              ? Math.max(0, (muniData?.resolvedIssues || 1) - 1)
              : muniData?.resolvedIssues || 0;

          await municipalityRef.update({
            totalIssues,
            resolvedIssues,
            updatedAt: new Date(),
          });

          // Recalculate score
          await recalculateMunicipalityScore(municipalityId);
        }
      }

      res.json({
        success: true,
        data: { deleted: issueId },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error deleting issue:", error?.message || String(error));
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to delete issue",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export { router as issueRoutes };
