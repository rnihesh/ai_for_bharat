"use client";

import { useCallback, useState, useEffect } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
  Rectangle,
} from "@react-google-maps/api";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, AlertTriangle, MapPin } from "lucide-react";
import { config } from "@/lib/config";
import { ClusterMarker } from "./ClusterMarker";
import { RiskHeatmap } from "./RiskHeatmap";

// Libraries to load - must be consistent across all map components
const libraries: ("places" | "geometry")[] = ["places"];

interface IssuePriority {
  score: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  reasoning?: string;
}

interface Issue {
  id: string;
  description: string;
  type: string;
  status: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  createdAt: string;
  municipalityId: string;
  imageUrls?: string[];
  priority?: IssuePriority;
}

interface MunicipalityBounds {
  id: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

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

interface RiskGridPoint {
  latitude: number;
  longitude: number;
  riskScore: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

interface GoogleMapComponentProps {
  issues: Issue[];
  municipalities?: MunicipalityBounds[];
  clusters?: ClusterData[];
  riskData?: {
    predictions: RiskGridPoint[];
    bounds: { north: number; south: number; east: number; west: number };
    gridSize: number;
  };
  center?: { lat: number; lng: number };
  zoom?: number;
  onBoundsChange?: (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => void;
  showMunicipalityBorders?: boolean;
  showClusters?: boolean;
  showRiskHeatmap?: boolean;
}

const containerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = config.map.defaultCenter;

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
  ],
};

const getMarkerColor = (status: string, priority?: IssuePriority): string => {
  // Closed issues are always green
  if (status === "CLOSED") {
    return "#22C55E"; // green
  }

  // If no priority, use status-based color
  if (!priority) {
    switch (status) {
      case "OPEN":
        return "#EF4444"; // red
      default:
        return "#6B7280"; // gray
    }
  }

  // Use priority-based coloring for open issues
  switch (priority.severity) {
    case "CRITICAL":
      return "#DC2626"; // red-600
    case "HIGH":
      return "#EA580C"; // orange-600
    case "MEDIUM":
      return "#CA8A04"; // yellow-600
    case "LOW":
      return "#16A34A"; // green-600
    default:
      return "#EF4444"; // red
  }
};

const getMarkerScale = (priority?: IssuePriority): number => {
  if (!priority) return 10;

  switch (priority.severity) {
    case "CRITICAL":
      return 14;
    case "HIGH":
      return 12;
    case "MEDIUM":
      return 10;
    case "LOW":
      return 8;
    default:
      return 10;
  }
};

const getPriorityBadgeHtml = (priority: IssuePriority): string => {
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    CRITICAL: { bg: "#FEE2E2", text: "#B91C1C", dot: "#EF4444" },
    HIGH: { bg: "#FFEDD5", text: "#C2410C", dot: "#F97316" },
    MEDIUM: { bg: "#FEF9C3", text: "#A16207", dot: "#EAB308" },
    LOW: { bg: "#DCFCE7", text: "#15803D", dot: "#22C55E" },
  };

  const config = colors[priority.severity] || colors.MEDIUM;
  const label = priority.severity.charAt(0) + priority.severity.slice(1).toLowerCase();

  return `
    <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 9999px; background: ${config.bg}; color: ${config.text}; font-size: 11px; font-weight: 500;">
      <span style="width: 6px; height: 6px; border-radius: 50%; background: ${config.dot};"></span>
      ${label} (${priority.score}/10)
    </span>
  `;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "OPEN":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "CLOSED":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    OPEN: "destructive",
    CLOSED: "default",
  };
  const labels: Record<string, string> = {
    OPEN: "Open",
    CLOSED: "Closed",
  };
  return (
    <Badge variant={variants[status] || "secondary"}>
      {labels[status] || status}
    </Badge>
  );
};

const getTypeBadge = (type: string) => {
  const colors: Record<string, string> = {
    POTHOLE: "bg-orange-100 text-orange-800",
    GARBAGE: "bg-green-100 text-green-800",
    DRAINAGE: "bg-blue-100 text-blue-800",
    STREETLIGHT: "bg-yellow-100 text-yellow-800",
    ROAD_DAMAGE: "bg-red-100 text-red-800",
    WATER_SUPPLY: "bg-cyan-100 text-cyan-800",
    OTHER: "bg-gray-100 text-gray-800",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${
        colors[type] || colors.OTHER
      }`}
    >
      {type.replace(/_/g, " ")}
    </span>
  );
};

export function GoogleMapComponent({
  issues,
  municipalities = [],
  clusters = [],
  riskData,
  center,
  zoom = 12,
  onBoundsChange,
  showMunicipalityBorders = true,
  showClusters = false,
  showRiskHeatmap = false,
}: GoogleMapComponentProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [hoveredMunicipality, setHoveredMunicipality] = useState<string | null>(
    null
  );
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationChecked, setLocationChecked] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  // Get user's location on mount (before map renders)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationChecked(true);
        },
        () => {
          // User denied location, use default
          console.log("Geolocation permission denied, using default location");
          setLocationChecked(true);
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    } else {
      setLocationChecked(true);
    }
  }, []);

  // Determine the map center: prop > user location > default
  const mapCenter = center || userLocation || defaultCenter;

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleBoundsChanged = useCallback(() => {
    if (map && onBoundsChange) {
      const bounds = map.getBounds();
      if (bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        onBoundsChange({
          north: ne.lat(),
          south: sw.lat(),
          east: ne.lng(),
          west: sw.lng(),
        });
      }
    }
  }, [map, onBoundsChange]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <div className="text-center p-8">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load map</h3>
          <p className="text-muted-foreground">
            Please check your API key configuration
          </p>
        </div>
      </div>
    );
  }

  // Wait for both: Google Maps to load AND location check to complete
  if (!isLoaded || !locationChecked) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {!locationChecked ? "Getting your location..." : "Loading map..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={mapCenter}
      zoom={zoom}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onBoundsChanged={handleBoundsChanged}
      options={mapOptions}
    >
      {/* Municipality border rectangles */}
      {showMunicipalityBorders &&
        municipalities.map((municipality) => (
          <Rectangle
            key={municipality.id}
            bounds={{
              north: municipality.bounds.north,
              south: municipality.bounds.south,
              east: municipality.bounds.east,
              west: municipality.bounds.west,
            }}
            options={{
              strokeColor:
                hoveredMunicipality === municipality.id ? "#2563EB" : "#6366F1",
              strokeOpacity: hoveredMunicipality === municipality.id ? 1 : 0.6,
              strokeWeight: hoveredMunicipality === municipality.id ? 3 : 2,
              fillColor: "#6366F1",
              fillOpacity:
                hoveredMunicipality === municipality.id ? 0.15 : 0.05,
              clickable: true,
              zIndex: hoveredMunicipality === municipality.id ? 2 : 1,
            }}
            onMouseOver={() => setHoveredMunicipality(municipality.id)}
            onMouseOut={() => setHoveredMunicipality(null)}
          />
        ))}

      {/* Hovered municipality name tooltip */}
      {hoveredMunicipality &&
        municipalities.find((m) => m.id === hoveredMunicipality) && (
          <InfoWindow
            position={{
              lat: municipalities.find((m) => m.id === hoveredMunicipality)!
                .bounds.north,
              lng:
                (municipalities.find((m) => m.id === hoveredMunicipality)!
                  .bounds.east +
                  municipalities.find((m) => m.id === hoveredMunicipality)!
                    .bounds.west) /
                2,
            }}
            options={{ disableAutoPan: true }}
          >
            <div className="px-2 py-1 font-medium text-sm">
              {municipalities.find((m) => m.id === hoveredMunicipality)?.name}
            </div>
          </InfoWindow>
        )}

      {/* Risk Heatmap Layer */}
      {showRiskHeatmap && riskData && (
        <RiskHeatmap
          predictions={riskData.predictions}
          bounds={riskData.bounds}
          gridSize={riskData.gridSize}
          opacity={0.5}
        />
      )}

      {/* Cluster Markers (when clustering is enabled) */}
      {showClusters && clusters.map((cluster) => (
        <ClusterMarker
          key={cluster.id}
          cluster={cluster}
        />
      ))}

      {/* Individual Issue Markers (when clustering is disabled) */}
      {!showClusters && issues.map((issue) => (
        <Marker
          key={issue.id}
          position={{
            lat: issue.location.latitude,
            lng: issue.location.longitude,
          }}
          onClick={() => setSelectedIssue(issue)}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: getMarkerScale(issue.priority),
            fillColor: getMarkerColor(issue.status, issue.priority),
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          }}
          zIndex={issue.priority ? issue.priority.score * 10 : 1}
        />
      ))}

      {selectedIssue && (
        <InfoWindow
          position={{
            lat: selectedIssue.location.latitude,
            lng: selectedIssue.location.longitude,
          }}
          onCloseClick={() => setSelectedIssue(null)}
        >
          <div className="p-2 max-w-xs">
            {/* Issue Image */}
            {selectedIssue.imageUrls && selectedIssue.imageUrls.length > 0 && (
              <div className="mb-2 -mx-2 -mt-2">
                <img
                  src={selectedIssue.imageUrls[0]}
                  alt="Issue"
                  className="w-full h-32 object-cover rounded-t"
                />
              </div>
            )}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {getStatusIcon(selectedIssue.status)}
              {getStatusBadge(selectedIssue.status)}
              {getTypeBadge(selectedIssue.type)}
            </div>
            {/* Priority Badge */}
            {selectedIssue.priority && (
              <div
                className="mb-2"
                dangerouslySetInnerHTML={{
                  __html: getPriorityBadgeHtml(selectedIssue.priority),
                }}
              />
            )}
            <p className="text-sm font-medium mb-1">
              {selectedIssue.description.slice(0, 100)}
              {selectedIssue.description.length > 100 ? "..." : ""}
            </p>
            {/* Priority reasoning */}
            {selectedIssue.priority?.reasoning && (
              <p className="text-xs text-gray-600 mb-1 italic">
                {selectedIssue.priority.reasoning.slice(0, 100)}
                {selectedIssue.priority.reasoning.length > 100 ? "..." : ""}
              </p>
            )}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="h-3 w-3" />
              <span>
                {selectedIssue.location.address ||
                  `${selectedIssue.location.latitude.toFixed(
                    4
                  )}, ${selectedIssue.location.longitude.toFixed(4)}`}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Reported: {selectedIssue.createdAt}
            </p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}

export default GoogleMapComponent;
