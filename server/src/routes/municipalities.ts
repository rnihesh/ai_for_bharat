import { Router, Request, Response } from "express";
import type { Router as IRouter } from "express";
import { getAdminDb, COLLECTIONS } from "../shared/firebase";
import {
  paginationSchema,
  municipalityRegistrationSchema,
} from "../shared/validation";
import type {
  Municipality,
  MunicipalityStats,
  LeaderboardEntry,
} from "../shared/types";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";

const router: IRouter = Router();

// Get leaderboard (public)
router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    const { page, pageSize } = paginationSchema.parse(req.query);

    const snapshot = await db
      .collection(COLLECTIONS.MUNICIPALITIES)
      .orderBy("score", "desc")
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .get();

    const entries: LeaderboardEntry[] = snapshot.docs.map((doc, index) => ({
      rank: (page - 1) * pageSize + index + 1,
      municipality: {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as Municipality,
      score: doc.data().score,
      trend: "STABLE" as const,
      previousRank: null,
    }));

    const countSnapshot = await db
      .collection(COLLECTIONS.MUNICIPALITIES)
      .count()
      .get();
    const total = countSnapshot.data().count;

    res.json({
      success: true,
      data: {
        entries,
        lastUpdated: new Date(),
        totalMunicipalities: total,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Error fetching leaderboard:",
      (error as any)?.message || String(error)
    );
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch leaderboard",
      timestamp: new Date().toISOString(),
    });
  }
});

// Get all municipalities (public)
router.get("/", async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    const { page, pageSize } = paginationSchema.parse(req.query);
    const { state, district } = req.query;

    let query = db.collection(COLLECTIONS.MUNICIPALITIES).orderBy("name");

    if (state) {
      query = query.where("state", "==", state);
    }
    if (district) {
      query = query.where("district", "==", district);
    }

    const snapshot = await query
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .get();

    const municipalities = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    }));

    const countSnapshot = await db
      .collection(COLLECTIONS.MUNICIPALITIES)
      .count()
      .get();
    const total = countSnapshot.data().count;

    res.json({
      success: true,
      data: {
        items: municipalities,
        total,
        page,
        pageSize,
        hasMore: (page - 1) * pageSize + municipalities.length < total,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Error fetching municipalities:",
      (error as any)?.message || String(error)
    );
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch municipalities",
      timestamp: new Date().toISOString(),
    });
  }
});

// Get single municipality (public)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    const doc = await db
      .collection(COLLECTIONS.MUNICIPALITIES)
      .doc(req.params.id)
      .get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        data: null,
        error: "Municipality not found",
        timestamp: new Date().toISOString(),
      });
    }

    const municipality = {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data()?.createdAt?.toDate(),
      updatedAt: doc.data()?.updatedAt?.toDate(),
    };

    res.json({
      success: true,
      data: municipality,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Error fetching municipality:",
      (error as any)?.message || String(error)
    );
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch municipality",
      timestamp: new Date().toISOString(),
    });
  }
});

// Get municipality stats (public)
router.get("/:id/stats", async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    const municipalityId = req.params.id;

    // Get all issues for this municipality
    const issuesSnapshot = await db
      .collection(COLLECTIONS.ISSUES)
      .where("municipalityId", "==", municipalityId)
      .get();

    const issues = issuesSnapshot.docs.map((doc) => doc.data());

    // Calculate stats
    const stats: MunicipalityStats = {
      municipalityId,
      totalIssues: issues.length,
      openIssues: issues.filter((i) => i.status === "OPEN").length,
      closedIssues: issues.filter((i) => i.status === "CLOSED").length,
      avgResolutionTimeHours: calculateAvgResolutionTime(issues),
      issuesByType: calculateIssuesByType(issues),
      monthlyTrend: calculateMonthlyTrend(issues),
    };

    res.json({
      success: true,
      data: stats,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Error fetching municipality stats:",
      (error as any)?.message || String(error)
    );
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch municipality stats",
      timestamp: new Date().toISOString(),
    });
  }
});

// Helper functions
function calculateAvgResolutionTime(issues: any[]): number | null {
  const resolvedIssues = issues.filter(
    (i) => i.status === "CLOSED" && i.resolution?.respondedAt && i.createdAt
  );

  if (resolvedIssues.length === 0) return null;

  const totalHours = resolvedIssues.reduce((sum, issue) => {
    const created = issue.createdAt?.toDate?.() || new Date(issue.createdAt);
    const resolved =
      issue.resolution.respondedAt?.toDate?.() ||
      new Date(issue.resolution.respondedAt);
    return sum + (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
  }, 0);

  return Math.round(totalHours / resolvedIssues.length);
}

function calculateIssuesByType(issues: any[]): Record<string, number> {
  return issues.reduce((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function calculateMonthlyTrend(
  issues: any[]
): Array<{ month: string; issues: number; resolved: number }> {
  const monthlyData: Record<string, { issues: number; resolved: number }> = {};

  issues.forEach((issue) => {
    const date = issue.createdAt?.toDate?.() || new Date(issue.createdAt);
    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { issues: 0, resolved: 0 };
    }
    monthlyData[monthKey].issues++;

    if (issue.status === "CLOSED") {
      monthlyData[monthKey].resolved++;
    }
  });

  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, data]) => ({ month, ...data }));
}

// ============================================
// MUNICIPALITY USER REGISTRATION
// ============================================

// Submit municipality registration request (requires authentication)
router.post(
  "/register",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();

      // Validate input
      const validationResult = municipalityRegistrationSchema.safeParse(
        req.body
      );

      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          data: null,
          error: validationResult.error.errors,
          timestamp: new Date().toISOString(),
        });
      }

      const input = validationResult.data;

      // Check if user already has a pending registration
      const existingReg = await db
        .collection("municipality_registrations")
        .where("userId", "==", req.user!.uid)
        .where("status", "==", "PENDING")
        .limit(1)
        .get();

      if (!existingReg.empty) {
        return res.status(400).json({
          success: false,
          data: null,
          error: "You already have a pending registration request",
          timestamp: new Date().toISOString(),
        });
      }

      // Check if user is already a municipality user
      const userDoc = await db
        .collection(COLLECTIONS.USERS)
        .doc(req.user!.uid)
        .get();
      if (userDoc.exists && userDoc.data()?.role === "municipality") {
        return res.status(400).json({
          success: false,
          data: null,
          error: "You are already registered as a municipality user",
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date();
      const registrationData = {
        ...input,
        userId: req.user!.uid,
        userEmail: req.user!.email,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await db
        .collection("municipality_registrations")
        .add(registrationData);

      res.status(201).json({
        success: true,
        data: {
          id: docRef.id,
          status: "PENDING",
          message:
            "Your registration request has been submitted. You will be notified once it is reviewed.",
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Error submitting registration:",
        (error as any)?.message || String(error)
      );
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to submit registration",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Check registration status
router.get(
  "/register/status",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();

      const snapshot = await db
        .collection("municipality_registrations")
        .where("userId", "==", req.user!.uid)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      if (snapshot.empty) {
        return res.json({
          success: true,
          data: null,
          error: null,
          timestamp: new Date().toISOString(),
        });
      }

      const registration = {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data(),
        createdAt: snapshot.docs[0].data().createdAt?.toDate(),
        updatedAt: snapshot.docs[0].data().updatedAt?.toDate(),
      };

      res.json({
        success: true,
        data: registration,
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Error fetching registration status:",
        (error as any)?.message || String(error)
      );
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to fetch registration status",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export { router as municipalityRoutes };
