"use client";

import { Marker, InfoWindow } from "@react-google-maps/api";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface ClusterData {
  id: string;
  centroid: { latitude: number; longitude: number };
  issueCount: number;
  aggregateSeverity: number;
  severityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  dominantType: string | null;
  typeCounts: Record<string, number>;
  radiusMeters: number;
  issueIds: string[];
}

interface ClusterMarkerProps {
  cluster: ClusterData;
  onClick?: (cluster: ClusterData) => void;
}

const getSeverityColor = (level: string): string => {
  switch (level) {
    case "CRITICAL":
      return "#DC2626"; // red-600
    case "HIGH":
      return "#EA580C"; // orange-600
    case "MEDIUM":
      return "#CA8A04"; // yellow-600
    case "LOW":
      return "#16A34A"; // green-600
    default:
      return "#6B7280"; // gray-500
  }
};

const getSeverityBgColor = (level: string): string => {
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

const getMarkerScale = (issueCount: number): number => {
  if (issueCount >= 10) return 24;
  if (issueCount >= 5) return 20;
  if (issueCount >= 3) return 16;
  return 14;
};

const formatTypeName = (type: string): string => {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};

export function ClusterMarker({ cluster, onClick }: ClusterMarkerProps) {
  const [showInfo, setShowInfo] = useState(false);

  const position = {
    lat: cluster.centroid.latitude,
    lng: cluster.centroid.longitude,
  };

  const color = getSeverityColor(cluster.severityLevel);
  const scale = getMarkerScale(cluster.issueCount);

  // Create custom marker icon with issue count
  const markerIcon = {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 0.9,
    strokeColor: "#ffffff",
    strokeWeight: 3,
  };

  return (
    <>
      <Marker
        position={position}
        icon={markerIcon}
        onClick={() => {
          setShowInfo(true);
          onClick?.(cluster);
        }}
        label={{
          text: String(cluster.issueCount),
          color: "#ffffff",
          fontWeight: "bold",
          fontSize: scale > 18 ? "14px" : "12px",
        }}
        zIndex={cluster.issueCount * 10}
      />

      {showInfo && (
        <InfoWindow position={position} onCloseClick={() => setShowInfo(false)}>
          <div className="p-2 min-w-[200px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Issue Cluster</h3>
              <Badge className={getSeverityBgColor(cluster.severityLevel)}>
                {cluster.severityLevel}
              </Badge>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Issues:</span>
                <span className="font-medium">{cluster.issueCount}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Avg Severity:</span>
                <span className="font-medium">
                  {cluster.aggregateSeverity.toFixed(1)}/10
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Radius:</span>
                <span className="font-medium">
                  {cluster.radiusMeters.toFixed(0)}m
                </span>
              </div>

              {cluster.dominantType && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Main Type:</span>
                  <span className="font-medium">
                    {formatTypeName(cluster.dominantType)}
                  </span>
                </div>
              )}

              {Object.keys(cluster.typeCounts).length > 1 && (
                <div className="pt-2 border-t">
                  <p className="text-gray-500 mb-1">Issue Types:</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(cluster.typeCounts).map(([type, count]) => (
                      <span
                        key={type}
                        className="px-1.5 py-0.5 bg-gray-100 rounded text-xs"
                      >
                        {formatTypeName(type)}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export default ClusterMarker;
