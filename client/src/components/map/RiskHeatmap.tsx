"use client";

import { Rectangle, InfoWindow } from "@react-google-maps/api";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";

interface RiskGridPoint {
  latitude: number;
  longitude: number;
  riskScore: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

interface RiskHeatmapProps {
  predictions: RiskGridPoint[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  gridSize: number;
  opacity?: number;
  onClick?: (point: RiskGridPoint) => void;
}

const getRiskColor = (score: number): string => {
  // Gradient from green (low) to yellow (medium) to red (high)
  if (score >= 0.8) return "#DC2626"; // red-600 (CRITICAL)
  if (score >= 0.6) return "#EA580C"; // orange-600 (HIGH)
  if (score >= 0.3) return "#CA8A04"; // yellow-600 (MEDIUM)
  return "#16A34A"; // green-600 (LOW)
};

const getRiskBgColor = (level: string): string => {
  switch (level) {
    case "CRITICAL":
      return "bg-red-100 text-red-800";
    case "HIGH":
      return "bg-orange-100 text-orange-800";
    case "MEDIUM":
      return "bg-yellow-100 text-yellow-800";
    case "LOW":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export function RiskHeatmap({
  predictions,
  bounds,
  gridSize,
  opacity = 0.4,
  onClick,
}: RiskHeatmapProps) {
  const [selectedPoint, setSelectedPoint] = useState<RiskGridPoint | null>(null);

  // Calculate cell dimensions
  const latStep = (bounds.north - bounds.south) / gridSize;
  const lngStep = (bounds.east - bounds.west) / gridSize;

  // Create grid cells from predictions
  const gridCells = useMemo(() => {
    return predictions.map((point, index) => {
      // Calculate cell bounds centered on the point
      const halfLatStep = latStep / 2;
      const halfLngStep = lngStep / 2;

      return {
        point,
        cellBounds: {
          north: point.latitude + halfLatStep,
          south: point.latitude - halfLatStep,
          east: point.longitude + halfLngStep,
          west: point.longitude - halfLngStep,
        },
        key: `risk-cell-${index}`,
      };
    });
  }, [predictions, latStep, lngStep]);

  return (
    <>
      {gridCells.map(({ point, cellBounds, key }) => (
        <Rectangle
          key={key}
          bounds={cellBounds}
          options={{
            fillColor: getRiskColor(point.riskScore),
            fillOpacity: opacity * (0.3 + point.riskScore * 0.7), // Higher risk = more visible
            strokeColor: getRiskColor(point.riskScore),
            strokeOpacity: 0.2,
            strokeWeight: 1,
            clickable: true,
            zIndex: Math.round(point.riskScore * 100),
          }}
          onClick={() => {
            setSelectedPoint(point);
            onClick?.(point);
          }}
        />
      ))}

      {selectedPoint && (
        <InfoWindow
          position={{
            lat: selectedPoint.latitude,
            lng: selectedPoint.longitude,
          }}
          onCloseClick={() => setSelectedPoint(null)}
        >
          <div className="p-2 min-w-[180px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Risk Assessment</h3>
              <Badge className={getRiskBgColor(selectedPoint.riskLevel)}>
                {selectedPoint.riskLevel}
              </Badge>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Risk Score:</span>
                <span className="font-medium">
                  {(selectedPoint.riskScore * 100).toFixed(0)}%
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Location:</span>
                <span className="font-medium text-right">
                  {selectedPoint.latitude.toFixed(4)},
                  <br />
                  {selectedPoint.longitude.toFixed(4)}
                </span>
              </div>

              {/* Risk indicator bar */}
              <div className="pt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>Low</span>
                  <span>High</span>
                </div>
                <div className="h-2 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full relative">
                  <div
                    className="absolute w-2 h-4 bg-white border-2 border-gray-800 rounded-full -top-1"
                    style={{
                      left: `calc(${selectedPoint.riskScore * 100}% - 4px)`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export default RiskHeatmap;
