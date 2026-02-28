import { Router, Request, Response } from "express";
import type { Router as IRouter } from "express";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDocClient, TABLES, GSI } from "../shared/aws";
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
    const client = getDocClient();
    const { page, pageSize } = paginationSchema.parse(req.query);

    // Query municipalities sorted by score (descending)
    const result = await client.send(new QueryCommand({
      TableName: TABLES.MUNICIPALITIES,
      IndexName: GSI.MUNICIPALITIES_BY_SCORE,
      KeyConditionExpression: '_pk = :pk',
      ExpressionAttributeValues: { ':pk': 'ALL' },
      ScanIndexForward: false,
    }));

    const allItems = result.Items || [];
    const total = allItems.length;
    const offset = (page - 1) * pageSize;
    const pageItems = allItems.slice(offset, offset + pageSize);

    const entries: LeaderboardEntry[] = pageItems.map((item, index) => ({
      rank: offset + index + 1,
      municipality: {
        id: item.municipalityId,
        ...item,
      } as Municipality,
      score: item.score,
      trend: "STABLE" as const,
      previousRank: null,
    }));

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
    console.error("Error fetching leaderboard:", (error as any)?.message || String(error));
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
    const client = getDocClient();
    const { page, pageSize } = paginationSchema.parse(req.query);
    const { state, district } = req.query;

    // Query by name GSI for sorted results
    const result = await client.send(new QueryCommand({
      TableName: TABLES.MUNICIPALITIES,
      IndexName: GSI.MUNICIPALITIES_BY_NAME,
      KeyConditionExpression: '_pk = :pk',
      ExpressionAttributeValues: { ':pk': 'ALL' },
      ScanIndexForward: true,
    }));

    let items = result.Items || [];

    // Apply filters in memory
    if (state) {
      items = items.filter((m) => m.state === state);
    }
    if (district) {
      items = items.filter((m) => m.district === district);
    }

    const total = items.length;
    const offset = (page - 1) * pageSize;
    const pageItems = items.slice(offset, offset + pageSize);

    const municipalities = pageItems.map((item) => ({
      id: item.municipalityId,
      ...item,
    }));

    res.json({
      success: true,
      data: {
        items: municipalities,
        total,
        page,
        pageSize,
        hasMore: offset + municipalities.length < total,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching municipalities:", (error as any)?.message || String(error));
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
    const result = await getDocClient().send(new GetCommand({
      TableName: TABLES.MUNICIPALITIES,
      Key: { municipalityId: req.params.id },
    }));

    if (!result.Item) {
      return res.status(404).json({
        success: false,
        data: null,
        error: "Municipality not found",
        timestamp: new Date().toISOString(),
      });
    }

    const municipality = {
      id: result.Item.municipalityId,
      ...result.Item,
    };

    res.json({
      success: true,
      data: municipality,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching municipality:", (error as any)?.message || String(error));
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
    const client = getDocClient();
    const municipalityId = req.params.id;

    // Get all issues for this municipality
    const issuesResult = await client.send(new QueryCommand({
      TableName: TABLES.ISSUES,
      IndexName: GSI.ISSUES_BY_MUNICIPALITY,
      KeyConditionExpression: 'municipalityId = :mid',
      ExpressionAttributeValues: { ':mid': municipalityId },
    }));

    const issues = issuesResult.Items || [];

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
    console.error("Error fetching municipality stats:", (error as any)?.message || String(error));
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
    const created = new Date(issue.createdAt);
    const resolved = new Date(issue.resolution.respondedAt);
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
    const date = new Date(issue.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

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

// Submit municipality registration request
router.post(
  "/register",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const client = getDocClient();

      const validationResult = municipalityRegistrationSchema.safeParse(req.body);

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
      const existingResult = await client.send(new QueryCommand({
        TableName: TABLES.MUNICIPALITY_REGISTRATIONS,
        IndexName: GSI.REGISTRATIONS_BY_USER,
        KeyConditionExpression: 'userId = :uid AND #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':uid': req.user!.uid, ':status': 'PENDING' },
        Limit: 1,
      }));

      if (existingResult.Items && existingResult.Items.length > 0) {
        return res.status(400).json({
          success: false,
          data: null,
          error: "You already have a pending registration request",
          timestamp: new Date().toISOString(),
        });
      }

      // Check if user is already a municipality user
      const userResult = await client.send(new GetCommand({
        TableName: TABLES.USERS,
        Key: { uid: req.user!.uid },
      }));
      if (userResult.Item?.role === "municipality") {
        return res.status(400).json({
          success: false,
          data: null,
          error: "You are already registered as a municipality user",
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date().toISOString();
      const registrationId = `REG-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

      const registrationData = {
        registrationId,
        ...input,
        userId: req.user!.uid,
        userEmail: req.user!.email,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      };

      await client.send(new PutCommand({
        TableName: TABLES.MUNICIPALITY_REGISTRATIONS,
        Item: registrationData,
      }));

      res.status(201).json({
        success: true,
        data: {
          id: registrationId,
          status: "PENDING",
          message: "Your registration request has been submitted. You will be notified once it is reviewed.",
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error submitting registration:", (error as any)?.message || String(error));
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
      const client = getDocClient();

      const result = await client.send(new QueryCommand({
        TableName: TABLES.MUNICIPALITY_REGISTRATIONS,
        IndexName: GSI.REGISTRATIONS_BY_USER,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': req.user!.uid },
        ScanIndexForward: false,
        Limit: 1,
      }));

      if (!result.Items || result.Items.length === 0) {
        return res.json({
          success: true,
          data: null,
          error: null,
          timestamp: new Date().toISOString(),
        });
      }

      const registration = {
        id: result.Items[0].registrationId,
        ...result.Items[0],
      };

      res.json({
        success: true,
        data: registration,
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching registration status:", (error as any)?.message || String(error));
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
