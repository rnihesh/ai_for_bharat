import { Router, Request, Response } from "express";
import type { Router as IRouter } from "express";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDocClient, TABLES, GSI } from "../shared/aws";
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
  classifyIssueWithAI,
} from "../services/location";
import type { Issue, IssueStatus, GeoLocation } from "../shared/types";

const router: IRouter = Router();

// Helper function to recalculate municipality score
async function recalculateMunicipalityScore(municipalityId: string) {
  const client = getDocClient();

  // Get all open issues for this municipality
  const openResult = await client.send(new QueryCommand({
    TableName: TABLES.ISSUES,
    IndexName: GSI.ISSUES_BY_MUNICIPALITY,
    KeyConditionExpression: 'municipalityId = :mid',
    FilterExpression: '#status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':mid': municipalityId, ':status': 'OPEN' },
  }));

  const openIssues = (openResult.Items || []).map((item) => ({
    id: item.issueId,
    createdAt: new Date(item.createdAt),
  }));

  // Get count of closed issues
  const closedResult = await client.send(new QueryCommand({
    TableName: TABLES.ISSUES,
    IndexName: GSI.ISSUES_BY_MUNICIPALITY,
    KeyConditionExpression: 'municipalityId = :mid',
    FilterExpression: '#status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':mid': municipalityId, ':status': 'CLOSED' },
    Select: 'COUNT',
  }));

  const closedCount = closedResult.Count || 0;

  // Calculate new score
  const { score } = calculateMunicipalityScore(openIssues, closedCount);

  // Update municipality score
  await client.send(new UpdateCommand({
    TableName: TABLES.MUNICIPALITIES,
    Key: { municipalityId },
    UpdateExpression: 'SET score = :score, updatedAt = :now',
    ExpressionAttributeValues: {
      ':score': score,
      ':now': new Date().toISOString(),
    },
  }));

  return score;
}

// Get all issues (public)
router.get("/", async (req: Request, res: Response) => {
  try {
    const client = getDocClient();
    const { page, pageSize } = paginationSchema.parse(req.query);
    const filters = issueFiltersSchema.parse(req.query);

    const hasStatusFilter = filters.status && filters.status.length > 0;
    const hasTypeFilter = filters.type && filters.type.length > 0;

    let items: Record<string, any>[] = [];

    if (filters.municipalityId) {
      // Use GSI for municipality filter
      const result = await client.send(new QueryCommand({
        TableName: TABLES.ISSUES,
        IndexName: GSI.ISSUES_BY_MUNICIPALITY,
        KeyConditionExpression: 'municipalityId = :mid',
        ExpressionAttributeValues: { ':mid': filters.municipalityId },
        ScanIndexForward: false,
        Limit: 500,
      }));
      items = result.Items || [];
    } else {
      // Scan all issues, sorted by createdAt desc
      const result = await client.send(new QueryCommand({
        TableName: TABLES.ISSUES,
        IndexName: GSI.ISSUES_BY_CREATED,
        KeyConditionExpression: '_pk = :pk',
        ExpressionAttributeValues: { ':pk': 'ALL' },
        ScanIndexForward: false,
        Limit: 500,
      }));
      items = result.Items || [];
    }

    let issues = items.map((item) => ({
      id: item.issueId,
      ...item,
    }));

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
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch issues: " + (error?.message || String(error)),
      timestamp: new Date().toISOString(),
    });
  }
});

// Get global stats (public)
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const client = getDocClient();

    // Get total issues count
    const totalResult = await client.send(new ScanCommand({
      TableName: TABLES.ISSUES,
      Select: 'COUNT',
    }));
    const totalIssues = totalResult.Count || 0;

    // Get resolved issues count
    const resolvedResult = await client.send(new QueryCommand({
      TableName: TABLES.ISSUES,
      IndexName: GSI.ISSUES_BY_STATUS,
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'CLOSED' },
      Select: 'COUNT',
    }));
    const resolvedIssues = resolvedResult.Count || 0;

    // Get municipalities count
    const muniResult = await client.send(new ScanCommand({
      TableName: TABLES.MUNICIPALITIES,
      Select: 'COUNT',
    }));
    const totalMunicipalities = muniResult.Count || 0;

    res.json({
      success: true,
      data: {
        totalIssues,
        resolvedIssues,
        openIssues: totalIssues - resolvedIssues,
        totalMunicipalities,
        avgResponseTime: 48,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching global stats:", error?.message || String(error));
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
    const result = await getDocClient().send(new GetCommand({
      TableName: TABLES.ISSUES,
      Key: { issueId: req.params.id },
    }));

    if (!result.Item) {
      return res.status(404).json({
        success: false,
        data: null,
        error: "Issue not found",
        timestamp: new Date().toISOString(),
      });
    }

    const issue = {
      id: result.Item.issueId,
      ...result.Item,
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
    const client = getDocClient();
    const { north, south, east, west } = req.query;

    if (!north || !south || !east || !west) {
      return res.status(400).json({
        success: false,
        data: null,
        error: "Missing bounds parameters",
        timestamp: new Date().toISOString(),
      });
    }

    // Scan with filter for latitude range, then filter longitude in memory
    const result = await client.send(new ScanCommand({
      TableName: TABLES.ISSUES,
      FilterExpression: '#loc.#lat BETWEEN :south AND :north',
      ExpressionAttributeNames: {
        '#loc': 'location',
        '#lat': 'latitude',
      },
      ExpressionAttributeValues: {
        ':south': parseFloat(south as string),
        ':north': parseFloat(north as string),
      },
      Limit: 500,
    }));

    const issues = (result.Items || [])
      .map((item) => ({
        id: item.issueId,
        ...item,
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
    console.error("Error fetching map issues:", error?.message || String(error));
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
    const client = getDocClient();

    const issueId = generateIssueId();
    const now = new Date().toISOString();

    const { latitude, longitude } = input.location;

    // Classify issue type using AI (if type not provided)
    let classifiedType: Issue["type"] = input.type || "POTHOLE";
    if (!input.type) {
      try {
        const classification = await classifyIssueWithAI(input.description);
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

    // Find the appropriate municipality based on location
    let municipalityId = "MUN-DEFAULT";
    let municipalityData: {
      name?: string;
      district?: string;
      state?: string;
    } | null = null;
    try {
      const municipalityMatch = await findMunicipalityForLocation(latitude, longitude);
      if (municipalityMatch) {
        municipalityId = municipalityMatch.municipalityId;
        console.log(
          `Issue assigned to municipality ${municipalityMatch.name} (${municipalityMatch.matchType})`
        );

        // Get municipality data for region fallback
        const muniResult = await client.send(new GetCommand({
          TableName: TABLES.MUNICIPALITIES,
          Key: { municipalityId },
        }));
        if (muniResult.Item) {
          municipalityData = {
            name: muniResult.Item.name || municipalityMatch.name,
            district: muniResult.Item.district,
            state: muniResult.Item.state,
          };
        }
      }
    } catch (err) {
      console.warn("Failed to find municipality for location:", err);
    }

    // Get administrative region from coordinates
    let region: Record<string, string> = {
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
        region = {
          state: municipalityData.state || "Unknown",
          district: municipalityData.district || "Unknown",
          municipality: municipalityData.name || "Unknown",
        };
      }
    } catch (err) {
      console.warn("Failed to get administrative region:", err);
      if (municipalityData) {
        region = {
          state: municipalityData.state || "Unknown",
          district: municipalityData.district || "Unknown",
          municipality: municipalityData.name || "Unknown",
        };
      }
    }

    const location: GeoLocation = { latitude, longitude };

    // Support both single imageUrl and imageUrls array
    const imageUrls =
      req.body.imageUrls || (input.imageUrl ? [input.imageUrl] : []);

    const issue = {
      issueId,
      _pk: 'ALL', // Partition key for global GSIs
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

    await client.send(new PutCommand({
      TableName: TABLES.ISSUES,
      Item: issue,
    }));

    // Update municipality stats (atomic increment)
    await client.send(new UpdateCommand({
      TableName: TABLES.MUNICIPALITIES,
      Key: { municipalityId },
      UpdateExpression: 'ADD totalIssues :inc SET updatedAt = :now',
      ExpressionAttributeValues: { ':inc': 1, ':now': now },
    })).catch(() => {
      // Municipality might not exist yet
    });

    // Recalculate municipality score
    await recalculateMunicipalityScore(municipalityId).catch(() => {});

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

      const client = getDocClient();

      // Get the issue
      const issueResult = await client.send(new GetCommand({
        TableName: TABLES.ISSUES,
        Key: { issueId: id },
      }));

      if (!issueResult.Item) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Issue not found",
          timestamp: new Date().toISOString(),
        });
      }

      const issue = issueResult.Item as Record<string, any>;

      // Check jurisdiction
      if (issue.municipalityId !== req.user?.municipalityId) {
        return res.status(403).json({
          success: false,
          data: null,
          error: "Issue not in your jurisdiction",
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date().toISOString();

      await client.send(new UpdateCommand({
        TableName: TABLES.ISSUES,
        Key: { issueId: id },
        UpdateExpression: 'SET #status = :status, municipalityResponse = :resp, resolution = :resolution, resolvedAt = :now, updatedAt = :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'CLOSED',
          ':resp': responseText || resolutionNote,
          ':resolution': {
            resolutionImageUrl: resolutionImageUrl || null,
            resolutionNote: responseText || resolutionNote,
            respondedAt: now,
            respondedBy: req.user?.uid,
            verificationScore: null,
            verifiedAt: null,
          },
          ':now': now,
        },
      }));

      // Update municipality resolved issues counter
      if (issue.status === "OPEN" && issue.municipalityId) {
        const muniResult = await client.send(new GetCommand({
          TableName: TABLES.MUNICIPALITIES,
          Key: { municipalityId: issue.municipalityId },
        }));
        if (muniResult.Item) {
          await client.send(new UpdateCommand({
            TableName: TABLES.MUNICIPALITIES,
            Key: { municipalityId: issue.municipalityId },
            UpdateExpression: 'SET resolvedIssues = :resolved, updatedAt = :now',
            ExpressionAttributeValues: {
              ':resolved': (muniResult.Item.resolvedIssues || 0) + 1,
              ':now': now,
            },
          }));
          await recalculateMunicipalityScore(issue.municipalityId);
        }
      }

      res.json({
        success: true,
        data: { issueId: id, status: "CLOSED" },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error responding to issue:", error?.message || String(error));

      if (error.name === "ZodError") {
        return res.status(400).json({
          success: false,
          data: null,
          error: "Validation failed: " + error.errors.map((e: any) => e.message).join(", "),
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

      const client = getDocClient();

      const issueResult = await client.send(new GetCommand({
        TableName: TABLES.ISSUES,
        Key: { issueId: id },
      }));

      if (!issueResult.Item) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Issue not found",
          timestamp: new Date().toISOString(),
        });
      }

      const issue = issueResult.Item;

      if (issue.municipalityId !== req.user?.municipalityId) {
        return res.status(403).json({
          success: false,
          data: null,
          error: "Issue not in your jurisdiction",
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date().toISOString();
      let updateExpr = 'SET #status = :status, updatedAt = :now';
      const exprValues: Record<string, any> = { ':status': status, ':now': now };

      if (status === "CLOSED") {
        updateExpr += ', resolvedAt = :now';
      }

      await client.send(new UpdateCommand({
        TableName: TABLES.ISSUES,
        Key: { issueId: id },
        UpdateExpression: updateExpr,
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: exprValues,
      }));

      // Update municipality stats if resolved
      if (status === "CLOSED" && issue.municipalityId) {
        const muniResult = await client.send(new GetCommand({
          TableName: TABLES.MUNICIPALITIES,
          Key: { municipalityId: issue.municipalityId },
        }));
        if (muniResult.Item) {
          await client.send(new UpdateCommand({
            TableName: TABLES.MUNICIPALITIES,
            Key: { municipalityId: issue.municipalityId },
            UpdateExpression: 'SET resolvedIssues = :resolved, updatedAt = :now',
            ExpressionAttributeValues: {
              ':resolved': (muniResult.Item.resolvedIssues || 0) + 1,
              ':now': now,
            },
          }));
        }
      }

      res.json({
        success: true,
        data: { issueId: id, status },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error updating issue status:", error?.message || String(error));
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to update issue status",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Recalculate all municipality scores
router.post("/recalculate-scores", async (_req: Request, res: Response) => {
  try {
    const client = getDocClient();

    const muniResult = await client.send(new ScanCommand({
      TableName: TABLES.MUNICIPALITIES,
    }));

    const results: {
      municipalityId: string;
      name: string;
      oldScore: number;
      newScore: number;
    }[] = [];

    for (const muni of muniResult.Items || []) {
      const oldScore = muni.score || 0;

      try {
        // Recalculate totalIssues and resolvedIssues from actual issues
        const allIssuesResult = await client.send(new QueryCommand({
          TableName: TABLES.ISSUES,
          IndexName: GSI.ISSUES_BY_MUNICIPALITY,
          KeyConditionExpression: 'municipalityId = :mid',
          ExpressionAttributeValues: { ':mid': muni.municipalityId },
        }));

        const totalIssues = allIssuesResult.Items?.length || 0;
        const resolvedIssues = (allIssuesResult.Items || []).filter(
          (i: any) => i.status === 'CLOSED'
        ).length;

        await client.send(new UpdateCommand({
          TableName: TABLES.MUNICIPALITIES,
          Key: { municipalityId: muni.municipalityId },
          UpdateExpression: 'SET totalIssues = :total, resolvedIssues = :resolved, updatedAt = :now',
          ExpressionAttributeValues: {
            ':total': totalIssues,
            ':resolved': resolvedIssues,
            ':now': new Date().toISOString(),
          },
        }));

        const newScore = await recalculateMunicipalityScore(muni.municipalityId);
        results.push({
          municipalityId: muni.municipalityId,
          name: muni.name,
          oldScore,
          newScore,
        });
      } catch (err) {
        console.error(`Failed to recalculate score for ${muni.municipalityId}:`, err);
      }
    }

    res.json({
      success: true,
      data: { updated: results.length, results },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error recalculating scores:", error?.message || String(error));
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
      const client = getDocClient();
      const { issueId } = req.params;

      const issueResult = await client.send(new GetCommand({
        TableName: TABLES.ISSUES,
        Key: { issueId },
      }));

      if (!issueResult.Item) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Issue not found",
          timestamp: new Date().toISOString(),
        });
      }

      const issueData = issueResult.Item;
      const municipalityId = issueData.municipalityId;

      await client.send(new DeleteCommand({
        TableName: TABLES.ISSUES,
        Key: { issueId },
      }));

      // Update municipality stats
      if (municipalityId) {
        const muniResult = await client.send(new GetCommand({
          TableName: TABLES.MUNICIPALITIES,
          Key: { municipalityId },
        }));

        if (muniResult.Item) {
          const muniData = muniResult.Item;
          const totalIssues = Math.max(0, (muniData.totalIssues || 1) - 1);
          const resolvedIssues =
            issueData.status === "CLOSED"
              ? Math.max(0, (muniData.resolvedIssues || 1) - 1)
              : muniData.resolvedIssues || 0;

          await client.send(new UpdateCommand({
            TableName: TABLES.MUNICIPALITIES,
            Key: { municipalityId },
            UpdateExpression: 'SET totalIssues = :total, resolvedIssues = :resolved, updatedAt = :now',
            ExpressionAttributeValues: {
              ':total': totalIssues,
              ':resolved': resolvedIssues,
              ':now': new Date().toISOString(),
            },
          }));

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
