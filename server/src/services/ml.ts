/**
 * ML Service Client
 *
 * Client for interacting with the ML service endpoints.
 */

import {
  IssueCluster,
  ClusteringResult,
  SeverityPrediction,
  RiskPrediction,
  RiskGridResult,
  GeoLocation,
  Issue,
} from "../shared/types";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

interface MLServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Make a request to the ML service
 */
async function mlRequest<T>(
  endpoint: string,
  method: "GET" | "POST" = "POST",
  body?: unknown
): Promise<MLServiceResponse<T>> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.detail || data.error || "ML service request failed",
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (error) {
    console.error("ML service error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "ML service unavailable",
    };
  }
}

/**
 * Cluster issues by geographic proximity
 */
export async function clusterIssues(
  issues: Array<{
    id: string;
    location: GeoLocation;
    type?: string;
    severity?: number;
  }>,
  options?: {
    eps_meters?: number;
    min_samples?: number;
  }
): Promise<MLServiceResponse<ClusteringResult>> {
  const requestBody = {
    issues: issues.map((issue) => ({
      id: issue.id,
      location: {
        latitude: issue.location.latitude,
        longitude: issue.location.longitude,
      },
      type: issue.type,
      severity: issue.severity,
    })),
    eps_meters: options?.eps_meters || 50,
    min_samples: options?.min_samples || 2,
  };

  const response = await mlRequest<{
    success: boolean;
    clusters: IssueCluster[];
    unclustered: unknown[];
    statistics: ClusteringResult["statistics"];
  }>("/cluster", "POST", requestBody);

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  return {
    success: true,
    data: {
      clusters: response.data.clusters,
      unclustered: response.data.unclustered as Issue[],
      statistics: response.data.statistics,
    },
  };
}

/**
 * Predict severity score for an issue
 */
export async function predictSeverity(
  imageUrl?: string,
  issueType?: string
): Promise<MLServiceResponse<SeverityPrediction>> {
  const response = await mlRequest<{
    success: boolean;
    score: number;
    level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    confidence: number;
    factors: string[];
    mlScore?: number;
    ruleScore?: number;
  }>("/predict-severity", "POST", {
    imageUrl,
    issueType,
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  return {
    success: true,
    data: {
      score: response.data.score,
      level: response.data.level,
      confidence: response.data.confidence,
      factors: response.data.factors,
      mlScore: response.data.mlScore,
      ruleScore: response.data.ruleScore,
    },
  };
}

/**
 * Predict infrastructure risk for a location
 */
export async function predictRisk(params: {
  latitude: number;
  longitude: number;
  rainfall_mm?: number;
  temperature_c?: number;
  humidity_pct?: number;
  road_type?: "highway" | "urban" | "rural";
  traffic_density?: number;
  issue_count_30d?: number;
  is_hotspot?: boolean;
  resolution_rate?: number;
  days_since_last_issue?: number;
  population_density?: number;
}): Promise<MLServiceResponse<RiskPrediction>> {
  const response = await mlRequest<{
    success: boolean;
    riskScore: number;
    riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    confidence: number;
    factors: string[];
    location: { latitude: number; longitude: number };
    weather: {
      rainfall_mm: number;
      temperature_c: number;
      humidity_pct: number;
      is_monsoon: boolean;
    };
  }>("/predict-risk", "POST", params);

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  return {
    success: true,
    data: {
      riskScore: response.data.riskScore,
      riskLevel: response.data.riskLevel,
      confidence: response.data.confidence,
      factors: response.data.factors,
      location: response.data.location,
      weather: response.data.weather,
    },
  };
}

/**
 * Predict risk for a grid of points (for heatmap)
 */
export async function predictRiskGrid(params: {
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  grid_size?: number;
  weather?: {
    rainfall_mm?: number;
    temperature_c?: number;
    humidity_pct?: number;
  };
}): Promise<MLServiceResponse<RiskGridResult>> {
  const response = await mlRequest<{
    success: boolean;
    predictions: Array<{
      latitude: number;
      longitude: number;
      riskScore: number;
      riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    }>;
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
    gridSize: number;
  }>("/predict-risk-grid", "POST", {
    bounds: params.bounds,
    grid_size: params.grid_size || 10,
    weather: params.weather,
  });

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  return {
    success: true,
    data: {
      predictions: response.data.predictions,
      bounds: response.data.bounds,
      gridSize: response.data.gridSize,
    },
  };
}

/**
 * Check ML service health
 */
export async function checkMLHealth(): Promise<boolean> {
  try {
    const response = await mlRequest<{ status: string }>("/health", "GET");
    return response.success && response.data?.status === "healthy";
  } catch {
    return false;
  }
}

/**
 * Get ML models information and metrics
 */
export async function getModelsInfo(): Promise<{
  models: {
    classifier: {
      name: string;
      status: string;
      classes: string[];
      num_classes: number;
    };
    severity: {
      name: string;
      status: string;
      metrics: {
        mae: number;
        mse: number;
        training_samples: number;
        validation_samples: number;
      } | null;
    };
    risk: {
      name: string;
      status: string;
    };
    clustering: {
      name: string;
      status: string;
      algorithm: string;
      default_params: {
        eps_meters: number;
        min_samples: number;
      };
    };
  };
  capabilities: string[];
} | null> {
  try {
    const response = await mlRequest<{
      success: boolean;
      models: {
        classifier: {
          name: string;
          status: string;
          classes: string[];
          num_classes: number;
        };
        severity: {
          name: string;
          status: string;
          metrics: {
            mae: number;
            mse: number;
            training_samples: number;
            validation_samples: number;
          } | null;
        };
        risk: {
          name: string;
          status: string;
        };
        clustering: {
          name: string;
          status: string;
          algorithm: string;
          default_params: {
            eps_meters: number;
            min_samples: number;
          };
        };
      };
      capabilities: string[];
    }>("/models", "GET");

    if (!response.success || !response.data) {
      return null;
    }

    return {
      models: response.data.models,
      capabilities: response.data.capabilities,
    };
  } catch {
    return null;
  }
}

export const mlService = {
  clusterIssues,
  predictSeverity,
  predictRisk,
  predictRiskGrid,
  checkMLHealth,
  getModelsInfo,
};
