"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { uploadImages } from "@/lib/cloudinary";
import { classifyImage, generateDescription } from "@/lib/classifier";
import { MapPicker } from "@/components/map";
import { CameraCapture } from "@/components/camera";
import {
  MapPin,
  Camera,
  Send,
  Shield,
  Trash2,
  Lightbulb,
  Construction,
  TreePine,
  Building,
  HelpCircle,
  Loader2,
  X,
  Image as ImageIcon,
  Upload,
  Sparkles,
} from "lucide-react";

// Issue types aligned with ML classifier categories
const issueTypes = [
  { value: "POTHOLE", label: "Potholes & Road Damage", icon: Construction },
  { value: "GARBAGE", label: "Littering/Garbage", icon: Trash2 },
  { value: "ILLEGAL_PARKING", label: "Illegal Parking", icon: Building },
  { value: "DAMAGED_SIGN", label: "Broken Road Signs", icon: Construction },
  { value: "FALLEN_TREE", label: "Fallen Trees", icon: TreePine },
  { value: "VANDALISM", label: "Vandalism/Graffiti", icon: Building },
  { value: "DEAD_ANIMAL", label: "Dead Animal Pollution", icon: HelpCircle },
  { value: "DAMAGED_CONCRETE", label: "Damaged Concrete Structures", icon: Construction },
  { value: "DAMAGED_ELECTRICAL", label: "Damaged Electric Poles/Wires", icon: Lightbulb },
];

export default function ReportIssuePage() {
  const router = useRouter();
  const { user, userProfile, getToken } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [classificationResult, setClassificationResult] = useState<{
    isValid: boolean;
    isUnrelated: boolean;
    issueType: string | null;
    confidence: number;
    message: string;
  } | null>(null);
  const [locationCoords, setLocationCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationSource, setLocationSource] = useState<"camera" | "gps" | "map" | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    description: "",
    issueType: "",
    location: "",
    images: [] as File[],
  });

  // Handle hydration mismatch for Radix UI components
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect non-users (municipality and admin should use their dashboards)
  useEffect(() => {
    if (userProfile && userProfile.role !== "USER") {
      router.replace(
        userProfile.role === "PLATFORM_MAINTAINER"
          ? "/admin/dashboard"
          : "/municipality/issues"
      );
    }
  }, [userProfile, router]);

  // Show nothing while redirecting or before mount
  if (!mounted || (userProfile && userProfile.role !== "USER")) {
    return null;
  }

  // Handle camera capture with auto-location
  const handleCameraCapture = async (imageData: {
    blob: Blob;
    dataUrl: string;
    location: { lat: number; lng: number } | null;
  }) => {
    setShowCamera(false);
    setIsUploading(true);

    try {
      // Create file from blob
      const file = new File([imageData.blob], `issue-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      // Upload to Cloudinary
      const { urls, errors } = await uploadImages([file]);

      if (urls.length > 0) {
        setUploadedImages((prev) => [...prev, ...urls]);
        toast.success("Photo captured and uploaded!");

        // Auto-set location from camera capture
        if (imageData.location) {
          setLocationCoords(imageData.location);
          setLocationSource("camera");
          setFormData((prev) => ({
            ...prev,
            location: `${imageData.location!.lat.toFixed(6)}, ${imageData.location!.lng.toFixed(6)}`,
          }));
          toast.success("Location automatically detected!");
        }

        // Run ML classification
        setIsClassifying(true);
        try {
          const result = await classifyImage(urls[0]);
          setClassificationResult({
            isValid: result.isValid,
            isUnrelated: result.isUnrelated,
            issueType: result.issueType,
            confidence: result.confidence,
            message: result.message,
          });

          if (result.isValid && !result.isUnrelated && result.issueType && result.confidence >= 0.70) {
            setFormData((prev) => ({
              ...prev,
              issueType: result.issueType!,
            }));
            toast.success(`Issue detected: ${issueTypes.find(t => t.value === result.issueType)?.label}`);
            
            // Auto-generate description using Gemini AI
            setIsGeneratingDescription(true);
            try {
              const descResult = await generateDescription(urls[0], result.issueType);
              if (descResult.success && descResult.description) {
                setFormData((prev) => ({
                  ...prev,
                  description: descResult.description!,
                }));
                toast.success("Description auto-generated!");
              }
            } catch (descError) {
              console.log("Description generation failed:", descError);
            } finally {
              setIsGeneratingDescription(false);
            }
          } else if (result.isUnrelated) {
            toast.warning("This doesn't appear to be a municipal issue.");
          }
        } catch (classifyError) {
          console.log("Classification failed:", classifyError);
        } finally {
          setIsClassifying(false);
        }
      }

      if (errors.length > 0) {
        errors.forEach((error) => toast.error(error));
      }
    } catch (error) {
      toast.error("Failed to process captured photo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const { urls, errors } = await uploadImages(files);

      if (urls.length > 0) {
        setUploadedImages((prev) => [...prev, ...urls]);
        toast.success(`${urls.length} image(s) uploaded successfully`);

        // Run ML classification on the first uploaded image
        if (urls.length > 0 && !classificationResult) {
          setIsClassifying(true);
          try {
            const result = await classifyImage(urls[0]);
            setClassificationResult({
              isValid: result.isValid,
              isUnrelated: result.isUnrelated,
              issueType: result.issueType,
              confidence: result.confidence,
              message: result.message,
            });

            // Auto-select issue type if classification is confident and NOT unrelated
            if (result.isValid && !result.isUnrelated && result.issueType && result.confidence >= 0.70) {
              setFormData((prev) => ({
                ...prev,
                issueType: result.issueType!,
              }));
              toast.success(`Issue type auto-detected: ${issueTypes.find(t => t.value === result.issueType)?.label || result.className}`);
              
              // Auto-generate description using Gemini AI
              setIsGeneratingDescription(true);
              try {
                const descResult = await generateDescription(urls[0], result.issueType);
                if (descResult.success && descResult.description) {
                  setFormData((prev) => ({
                    ...prev,
                    description: descResult.description!,
                  }));
                  toast.success("Description auto-generated!");
                }
              } catch (descError) {
                console.log("Description generation failed:", descError);
              } finally {
                setIsGeneratingDescription(false);
              }
            } else if (result.isUnrelated) {
              toast.warning("This image doesn't appear to show a municipal issue. Please upload a different photo.");
            }
          } catch (classifyError) {
            console.log("Classification failed:", classifyError);
          } finally {
            setIsClassifying(false);
          }
        }
      }

      if (errors.length > 0) {
        errors.forEach((error) => toast.error(error));
      }
    } catch (error) {
      toast.error("Failed to upload images");
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    // Clear classification if all images removed
    if (uploadedImages.length <= 1) {
      setClassificationResult(null);
    }
  };

  const handleGetLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocationCoords({ lat: latitude, lng: longitude });
          setLocationSource("gps");
          setFormData((prev) => ({
            ...prev,
            location: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          }));
          toast.success("Location detected!");
        },
        () => {
          toast.error("Could not get location", {
            description: "Please select on map or enter manually.",
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }
  };

  const handleMapLocationSelect = (location: { lat: number; lng: number }) => {
    setLocationCoords(location);
    setLocationSource("map");
    setFormData((prev) => ({
      ...prev,
      location: `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.issueType) {
      toast.error("Please select an issue type");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Please provide a description");
      return;
    }

    if (!locationCoords) {
      toast.error("Please provide a location");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await getToken();

      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
        }/issues`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            description: formData.description,
            type: formData.issueType,
            location: {
              latitude: locationCoords.lat,
              longitude: locationCoords.lng,
            },
            imageUrls: uploadedImages,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Issue reported successfully!", {
          description: "Your complaint has been registered.",
        });
        // Reset form
        setFormData({
          description: "",
          issueType: "",
          location: "",
          images: [],
        });
        setLocationCoords(null);
        setUploadedImages([]);
        // Redirect to map to see the issue
        router.push("/map");
      } else {
        toast.error("Failed to submit issue", {
          description: data.error || "Please try again later.",
        });
      }
    } catch {
      toast.error("Failed to submit issue", {
        description: "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />

      <main className="flex-1 container py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Report a Civic Issue</CardTitle>
              <CardDescription>
                Your report will be submitted anonymously. All fields marked
                with * are required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Issue Type */}
                <div className="space-y-2">
                  <Label htmlFor="issueType">Issue Type *</Label>
                  <Select
                    value={formData.issueType}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, issueType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select issue type" />
                    </SelectTrigger>
                    <SelectContent>
                      {issueTypes.map((type) => {
                        const Icon = type.icon;
                        return (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="description">Description *</Label>
                    {uploadedImages.length > 0 && formData.issueType && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          setIsGeneratingDescription(true);
                          try {
                            const result = await generateDescription(
                              uploadedImages[0],
                              formData.issueType
                            );
                            if (result.success && result.description) {
                              setFormData((prev) => ({
                                ...prev,
                                description: result.description!,
                              }));
                              toast.success("Description generated!");
                            } else {
                              toast.error(result.error || "Failed to generate description");
                            }
                          } catch (error) {
                            toast.error("Failed to generate description");
                          } finally {
                            setIsGeneratingDescription(false);
                          }
                        }}
                        disabled={isGeneratingDescription}
                        className="h-7 text-xs gap-1"
                      >
                        {isGeneratingDescription ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" />
                            Auto-generate with AI
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="relative">
                    <Textarea
                      id="description"
                      placeholder={isGeneratingDescription ? "Generating description with AI..." : "Describe the issue in detail..."}
                      rows={4}
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      disabled={isGeneratingDescription}
                      required
                    />
                    {isGeneratingDescription && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  {formData.description && (
                    <p className="text-xs text-muted-foreground">
                      You can edit the auto-generated description above.
                    </p>
                  )}
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <div className="flex gap-2 mb-3">
                    <Input
                      id="location"
                      placeholder="Select location on map or enter coordinates"
                      value={formData.location}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          location: e.target.value,
                        }));
                        const coords = e.target.value
                          .split(",")
                          .map((s) => parseFloat(s.trim()));
                        if (
                          coords.length === 2 &&
                          !isNaN(coords[0]) &&
                          !isNaN(coords[1])
                        ) {
                          setLocationCoords({
                            lat: coords[0],
                            lng: coords[1],
                          });
                        }
                      }}
                      required
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGetLocation}
                      title="Auto-detect my location"
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Map Picker */}
                  <MapPicker
                    selectedLocation={locationCoords}
                    onLocationSelect={handleMapLocationSelect}
                    height="250px"
                  />
                </div>

                {/* Image Capture/Upload */}
                <div className="space-y-2">
                  <Label>Photo of the Issue</Label>
                  <div className="border-2 border-dashed rounded-lg p-4">
                    {/* Uploaded Images Preview - Inside the box */}
                    {uploadedImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {uploadedImages.map((url, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt={`Uploaded ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Classification Result */}
                    {classificationResult && (
                      <div className={`mb-4 p-3 rounded-lg ${
                        classificationResult.isUnrelated
                          ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
                          : classificationResult.isValid 
                            ? classificationResult.confidence > 0.85 
                              ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800' 
                              : 'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800'
                            : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
                      }`}>
                        <p className={`text-sm font-medium ${
                          classificationResult.isUnrelated
                            ? 'text-red-800 dark:text-red-200'
                            : classificationResult.isValid 
                              ? classificationResult.confidence > 0.85 
                                ? 'text-green-800 dark:text-green-200' 
                                : 'text-yellow-800 dark:text-yellow-200'
                              : 'text-red-800 dark:text-red-200'
                        }`}>
                          {classificationResult.isUnrelated 
                            ? '❌ This doesn\'t appear to be a municipal issue'
                            : classificationResult.isValid 
                              ? `✓ Detected: ${issueTypes.find(t => t.value === formData.issueType)?.label || classificationResult.issueType} (${Math.round(classificationResult.confidence * 100)}% confidence)`
                              : '⚠️ Could not confidently identify the issue type'
                          }
                        </p>
                        <p className="text-xs mt-1 text-muted-foreground">
                          {classificationResult.message}
                        </p>
                      </div>
                    )}

                    {/* Capture/Upload Controls */}
                    <div className="text-center">
                      {isUploading || isClassifying ? (
                        <div className="flex flex-col items-center py-2">
                          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {isUploading ? 'Uploading image...' : 'AI is analyzing your image...'}
                          </p>
                        </div>
                      ) : uploadedImages.length === 0 ? (
                        <>
                          <Camera className="h-10 w-10 mx-auto text-primary mb-3" />
                          <p className="text-sm font-medium mb-1">
                            Capture the issue
                          </p>
                          <p className="text-xs text-muted-foreground mb-4">
                            Take a photo to auto-detect location & issue type
                          </p>
                          <div className="flex flex-col gap-2">
                            <Button
                              type="button"
                              onClick={() => setShowCamera(true)}
                              className="w-full"
                            >
                              <Camera className="h-4 w-4 mr-2" />
                              Open Camera
                            </Button>
                            <div className="relative">
                              <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                              </div>
                              <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                  or
                                </span>
                              </div>
                            </div>
                            <Input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              id="images"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                handleImageUpload(files);
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                document.getElementById("images")?.click()
                              }
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload from Gallery
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground mb-3">
                            {uploadedImages.length} photo(s) added
                          </p>
                          <div className="flex gap-2 justify-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowCamera(true)}
                            >
                              <Camera className="h-4 w-4 mr-2" />
                              Add More
                            </Button>
                            <Input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              id="images-more"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                handleImageUpload(files);
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                document.getElementById("images-more")?.click()
                              }
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Location auto-detected notice */}
                {locationSource === "camera" && locationCoords && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Location auto-detected from camera capture
                    </p>
                  </div>
                )}

                {/* Anonymous Notice */}
                <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Your identity is protected
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Reports are submitted anonymously. No personal information
                      is collected or shared with municipalities.
                    </p>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting || isUploading}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      Submit Report
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />

      {/* Camera Capture Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
