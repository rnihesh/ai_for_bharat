/**
 * ML Routes - Clustering, severity, risk prediction
 */

import { Router, Request, Response } from "express";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient, TABLES, GSI } from "../shared/aws";
import { mlService } from "../services/ml";

const router = Router();

/**
 * POST /api/ml/cluster
 */
router.post("/cluster", async (req: Request, res: Response) => {
  try {
    const { eps_meters, min_samples, bounds, municipalityId, status } = req.body;
    const client = getDocClient();

    let items: Record<string, any>[] = [];

    if (municipalityId) {
      const result = await client.send(new QueryCommand({
        TableName: TABLES.ISSUES,
        IndexName: GSI.ISSUES_BY_MUNICIPALITY,
        KeyConditionExpression: 'municipalityId = :mid',
        ExpressionAttributeValues: { ':mid': municipalityId },
        Limit: 500,
      }));
      items = result.Items || [];
    } else {
      const result = await client.send(new ScanCommand({
        TableName: TABLES.ISSUES,
        Limit: 500,
      }));
      items = result.Items || [];
    }

    // Apply status filter
    if (status) {
      items = items.filter((i) => i.status === status);
    }

    const issues: Array<{
      id: string;
      location: { latitude: number; longitude: number };
      type?: string;
      severity?: number;
    }> = [];

    for (const item of items) {
      if (item.location?.latitude && item.location?.longitude) {
        // Filter by bounds if provided
        if (bounds) {
          const lat = item.location.latitude;
          const lng = item.location.longitude;
          if (
            lat < bounds.south ||
            lat > bounds.north ||
            lng < bounds.west ||
            lng > bounds.east
          ) {
            continue;
          }
        }

        issues.push({
          id: item.issueId,
          location: {
            latitude: item.location.latitude,
            longitude: item.location.longitude,
          },
          type: item.type,
          severity: item.priority_score,
        });
      }
    }

    const result = await mlService.clusterIssues(issues, {
      eps_meters,
      min_samples,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cluster error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Clustering failed",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/ml/predict-severity
 */
router.post("/predict-severity", async (req: Request, res: Response) => {
  try {
    const { imageUrl, issueType } = req.body;

    const result = await mlService.predictSeverity(imageUrl, issueType);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Severity prediction error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Severity prediction failed",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/ml/predict-risk
 */
router.post("/predict-risk", async (req: Request, res: Response) => {
  try {
    const {
      latitude,
      longitude,
      rainfall_mm,
      temperature_c,
      humidity_pct,
      road_type,
      traffic_density,
    } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: "latitude and longitude are required",
        timestamp: new Date().toISOString(),
      });
    }

    const client = getDocClient();

    // Get historical data for the location (~1km radius)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Scan for nearby issues (latitude filter, then filter longitude in memory)
    const nearbyResult = await client.send(new ScanCommand({
      TableName: TABLES.ISSUES,
      FilterExpression: '#loc.#lat BETWEEN :south AND :north',
      ExpressionAttributeNames: {
        '#loc': 'location',
        '#lat': 'latitude',
      },
      ExpressionAttributeValues: {
        ':south': latitude - 0.01,
        ':north': latitude + 0.01,
      },
    }));

    let issueCount30d = 0;
    let resolvedCount = 0;
    let lastIssueDate: Date | null = null;

    const nearbyItems = (nearbyResult.Items || []).filter((item) => {
      const lng = item.location?.longitude;
      return lng && Math.abs(lng - longitude) <= 0.01;
    });

    for (const item of nearbyItems) {
      const createdAt = new Date(item.createdAt);
      if (createdAt >= thirtyDaysAgo) {
        issueCount30d++;
      }
      if (item.status === "CLOSED") {
        resolvedCount++;
      }
      if (!lastIssueDate || createdAt > lastIssueDate) {
        lastIssueDate = createdAt;
      }
    }

    const totalNearby = nearbyItems.length;
    const resolutionRate = totalNearby > 0 ? resolvedCount / totalNearby : 0.7;
    const daysSinceLastIssue = lastIssueDate
      ? Math.floor((Date.now() - lastIssueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 365;
    const isHotspot = issueCount30d >= 10;

    const result = await mlService.predictRisk({
      latitude,
      longitude,
      rainfall_mm,
      temperature_c,
      humidity_pct,
      road_type,
      traffic_density,
      issue_count_30d: issueCount30d,
      is_hotspot: isHotspot,
      resolution_rate: resolutionRate,
      days_since_last_issue: daysSinceLastIssue,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Risk prediction error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Risk prediction failed",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/ml/predict-risk-grid
 */
router.post("/predict-risk-grid", async (req: Request, res: Response) => {
  try {
    const { bounds, grid_size, weather } = req.body;

    if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
      return res.status(400).json({
        success: false,
        error: "bounds (north, south, east, west) are required",
        timestamp: new Date().toISOString(),
      });
    }

    const result = await mlService.predictRiskGrid({
      bounds,
      grid_size,
      weather,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Risk grid prediction error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Risk grid prediction failed",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/ml/health
 */
router.get("/health", async (_req: Request, res: Response) => {
  try {
    const isHealthy = await mlService.checkMLHealth();

    return res.json({
      success: true,
      data: {
        mlService: isHealthy ? "healthy" : "unavailable",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Health check failed",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/ml/models
 */
router.get("/models", async (_req: Request, res: Response) => {
  try {
    const modelsInfo = await mlService.getModelsInfo();

    return res.json({
      success: true,
      data: modelsInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Models info error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get models info",
      timestamp: new Date().toISOString(),
    });
  }
});

export const mlRoutes = router;
