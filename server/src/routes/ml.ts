/**
 * ML Routes
 *
 * Routes for ML-powered features: clustering, severity, risk prediction.
 */

import { Router, Request, Response } from "express";
import { getAdminDb, COLLECTIONS } from "../shared/firebase";
import { mlService } from "../services/ml";

const router = Router();

/**
 * POST /api/ml/cluster
 * Cluster issues by geographic proximity
 */
router.post("/cluster", async (req: Request, res: Response) => {
  try {
    const { eps_meters, min_samples, bounds, municipalityId, status } = req.body;

    // Build query for issues
    const db = getAdminDb();
    let query = db.collection(COLLECTIONS.ISSUES).limit(500);

    if (municipalityId) {
      query = query.where("municipalityId", "==", municipalityId);
    }

    if (status) {
      query = query.where("status", "==", status);
    }

    // Fetch issues
    const snapshot = await query.get();
    const issues: Array<{
      id: string;
      location: { latitude: number; longitude: number };
      type?: string;
      severity?: number;
    }> = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.location?.latitude && data.location?.longitude) {
        // Filter by bounds if provided
        if (bounds) {
          const lat = data.location.latitude;
          const lng = data.location.longitude;
          if (
            lat < bounds.south ||
            lat > bounds.north ||
            lng < bounds.west ||
            lng > bounds.east
          ) {
            return;
          }
        }

        issues.push({
          id: doc.id,
          location: {
            latitude: data.location.latitude,
            longitude: data.location.longitude,
          },
          type: data.type,
          severity: data.priority_score,
        });
      }
    });

    // Call ML service
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
 * Predict severity for an issue
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
 * Predict risk for a location
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

    // Get historical data for the location
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Count issues in area (0.01 degree ≈ 1km)
    const db = getAdminDb();
    const nearbyIssuesSnapshot = await db
      .collection(COLLECTIONS.ISSUES)
      .where("location.latitude", ">=", latitude - 0.01)
      .where("location.latitude", "<=", latitude + 0.01)
      .get();

    let issueCount30d = 0;
    let resolvedCount = 0;
    let lastIssueDate: Date | null = null;

    nearbyIssuesSnapshot.forEach((doc) => {
      const data = doc.data();
      const lng = data.location?.longitude;
      if (lng && Math.abs(lng - longitude) <= 0.01) {
        const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
        if (createdAt >= thirtyDaysAgo) {
          issueCount30d++;
        }
        if (data.status === "CLOSED") {
          resolvedCount++;
        }
        if (!lastIssueDate || createdAt > lastIssueDate) {
          lastIssueDate = createdAt;
        }
      }
    });

    const totalNearby = nearbyIssuesSnapshot.size;
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
 * Predict risk for a grid (for heatmap)
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
 * Check ML service health
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
 * Get ML models information and metrics
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
