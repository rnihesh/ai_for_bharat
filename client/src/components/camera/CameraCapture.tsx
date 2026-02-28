"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera,
  X,
  SwitchCamera,
  Loader2,
  MapPin,
  Check,
  AlertTriangle,
} from "lucide-react";

interface CameraCaptureProps {
  onCapture: (imageData: {
    blob: Blob;
    dataUrl: string;
    location: { lat: number; lng: number } | null;
  }) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"loading" | "success" | "error" | "idle">("idle");

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: unknown) {
      console.error("Camera error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("NotAllowedError") || errorMessage.includes("Permission")) {
        setError("Camera permission denied. Please allow camera access.");
      } else if (errorMessage.includes("NotFoundError")) {
        setError("No camera found on this device.");
      } else {
        setError("Failed to access camera. Please try again.");
      }
    }
  }, [facingMode, stream]);

  // Get current location
  const getLocation = useCallback(() => {
    setLocationStatus("loading");
    
    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus("success");
      },
      (err) => {
        console.error("Location error:", err);
        setLocationStatus("error");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // Initialize camera and location on mount
  useEffect(() => {
    startCamera();
    getLocation();

    return () => {
      // Cleanup stream on unmount
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restart camera when facing mode changes
  useEffect(() => {
    if (stream) {
      startCamera();
    }
  }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Capture photo
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas size to video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");
      
      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0);
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create blob"));
          },
          "image/jpeg",
          0.9
        );
      });

      // Get data URL for preview
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

      // Stop camera
      stream?.getTracks().forEach((track) => track.stop());

      // Call onCapture with image and location
      onCapture({
        blob,
        dataUrl,
        location,
      });
    } catch (err) {
      console.error("Capture error:", err);
      setError("Failed to capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  // Switch camera (front/back)
  const switchCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="h-6 w-6" />
        </Button>
        
        <div className="flex items-center gap-2 text-white text-sm">
          {locationStatus === "loading" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Getting location...</span>
            </>
          )}
          {locationStatus === "success" && (
            <>
              <MapPin className="h-4 w-4 text-green-400" />
              <span className="text-green-400">Location captured</span>
            </>
          )}
          {locationStatus === "error" && (
            <>
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="text-yellow-400">Location unavailable</span>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={switchCamera}
          className="text-white hover:bg-white/20"
        >
          <SwitchCamera className="h-6 w-6" />
        </Button>
      </div>

      {/* Camera View */}
      {error ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-white">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-red-400" />
            <p className="text-lg mb-4">{error}</p>
            <Button onClick={startCamera} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="flex-1 object-cover"
        />
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Capture Button */}
      <div className="absolute bottom-0 left-0 right-0 p-8 flex items-center justify-center bg-gradient-to-t from-black/60 to-transparent">
        <button
          onClick={capturePhoto}
          disabled={isCapturing || !!error}
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform"
        >
          {isCapturing ? (
            <Loader2 className="h-10 w-10 text-white animate-spin" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white" />
          )}
        </button>
      </div>

      {/* Guide text */}
      <div className="absolute bottom-32 left-0 right-0 text-center">
        <p className="text-white/80 text-sm">
          Point camera at the issue and tap to capture
        </p>
      </div>
    </div>
  );
}
