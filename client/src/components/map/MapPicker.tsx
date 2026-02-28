"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { AlertTriangle, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";

interface MapPickerProps {
  onLocationSelect: (location: { lat: number; lng: number }) => void;
  selectedLocation?: { lat: number; lng: number } | null;
  height?: string;
}

// Libraries to load - defined outside component to prevent reloads
const libraries: ("places" | "geometry")[] = ["places"];

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
  fullscreenControl: false,
  styles: [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
  ],
};

export function MapPicker({
  onLocationSelect,
  selectedLocation,
  height = "300px",
}: MapPickerProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [center, setCenter] = useState(selectedLocation || defaultCenter);
  const [markerPosition, setMarkerPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(selectedLocation || null);
  const [isMounted, setIsMounted] = useState(false);
  const mapKey = useRef(Date.now());

  // Ensure component is mounted before rendering map (fixes SSR issues)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: config.map.googleMapsApiKey,
    libraries,
  });

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Handle map click to set marker
  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setMarkerPosition({ lat, lng });
        onLocationSelect({ lat, lng });
      }
    },
    [onLocationSelect]
  );

  // Get user's current location
  const handleGetCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation = { lat: latitude, lng: longitude };
          setMarkerPosition(newLocation);
          setCenter(newLocation);
          onLocationSelect(newLocation);
          if (map) {
            map.panTo(newLocation);
            map.setZoom(16);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, [map, onLocationSelect]);

  // Update marker position when selectedLocation prop changes
  useEffect(() => {
    if (selectedLocation) {
      setMarkerPosition(selectedLocation);
      setCenter(selectedLocation);
      if (map) {
        map.panTo(selectedLocation);
      }
    }
  }, [selectedLocation, map]);

  // Try to get user's location on initial load
  useEffect(() => {
    if (map && !selectedLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCenter = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCenter(newCenter);
          map.panTo(newCenter);
        },
        () => {
          // User denied location, stay at default center
          console.log("Geolocation permission denied, using default location");
        }
      );
    }
  }, [map, selectedLocation]);

  if (loadError) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded-lg"
        style={{ height }}
      >
        <div className="text-center p-4">
          <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load map</p>
        </div>
      </div>
    );
  }

  if (!isLoaded || !isMounted) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded-lg"
        style={{ height }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="relative rounded-lg overflow-hidden border"
        style={{ height }}
      >
        <GoogleMap
          key={mapKey.current}
          mapContainerStyle={containerStyle}
          center={center}
          zoom={14}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onClick={handleMapClick}
          options={mapOptions}
        >
          {markerPosition && (
            <Marker
              position={markerPosition}
              draggable={true}
              onDragEnd={(e) => {
                if (e.latLng) {
                  const lat = e.latLng.lat();
                  const lng = e.latLng.lng();
                  setMarkerPosition({ lat, lng });
                  onLocationSelect({ lat, lng });
                }
              }}
            />
          )}
        </GoogleMap>

        {/* Current Location Button */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="absolute bottom-3 right-3 shadow-md"
          onClick={handleGetCurrentLocation}
        >
          <Crosshair className="h-4 w-4 mr-1" />
          My Location
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Click on the map to select a location, or drag the marker to adjust
      </p>
    </div>
  );
}

export default MapPicker;
