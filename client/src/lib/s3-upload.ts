/**
 * S3 Upload Utilities
 * Handles image uploads via presigned URLs from the backend
 */

import { config } from "./config";

const API_BASE_URL = config.api.baseUrl;

interface PresignedUrlResponse {
  success: boolean;
  data: {
    uploadUrl: string;
    fileKey: string;
    publicUrl: string;
  };
}

interface UploadResult {
  success: boolean;
  url?: string;
  fileKey?: string;
  error?: string;
}

/**
 * Get a presigned upload URL from the backend
 */
async function getPresignedUrl(
  contentType: string,
  token?: string
): Promise<PresignedUrlResponse | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/upload/presigned-url`, {
      method: "POST",
      headers,
      body: JSON.stringify({ contentType }),
    });

    const data = await response.json();
    if (data.success) {
      return data;
    }
    return null;
  } catch (error) {
    console.error("Error getting presigned URL:", error);
    return null;
  }
}

/**
 * Upload a single image to S3 using a presigned URL
 */
export async function uploadImage(
  file: File,
  token?: string
): Promise<UploadResult> {
  try {
    // Get presigned URL from backend
    const presignedData = await getPresignedUrl(file.type, token);

    if (!presignedData) {
      return { success: false, error: "Failed to get upload URL" };
    }

    const { uploadUrl, fileKey, publicUrl } = presignedData.data;

    // Upload directly to S3
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
      },
      body: file,
    });

    if (!response.ok) {
      console.error("S3 upload failed:", response.status);
      return { success: false, error: "Failed to upload image" };
    }

    return {
      success: true,
      url: publicUrl,
      fileKey,
    };
  } catch (error) {
    console.error("Error uploading to S3:", error);
    return { success: false, error: "Failed to upload image" };
  }
}

/**
 * Upload multiple images to S3
 */
export async function uploadImages(
  files: File[],
  token?: string
): Promise<{ urls: string[]; errors: string[] }> {
  const results = await Promise.all(files.map((f) => uploadImage(f, token)));

  const urls: string[] = [];
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.success && result.url) {
      urls.push(result.url);
    } else {
      errors.push(`Failed to upload ${files[index].name}: ${result.error}`);
    }
  });

  return { urls, errors };
}

/**
 * Get optimized image URL via CloudFront
 * CloudFront can be configured with Lambda@Edge for on-the-fly image transformations
 */
export function getOptimizedImageUrl(
  url: string,
  options: { width?: number; height?: number; quality?: number } = {}
): string {
  // If CloudFront image transformation is configured, append query params
  // Otherwise return the original URL as CloudFront serves it directly
  const { width, height, quality } = options;

  if (url.includes("cloudfront.net") && (width || height || quality)) {
    const params = new URLSearchParams();
    if (width) params.set("w", width.toString());
    if (height) params.set("h", height.toString());
    if (quality) params.set("q", quality.toString());
    return `${url}?${params.toString()}`;
  }

  return url;
}

/**
 * Get thumbnail URL for an image
 */
export function getThumbnailUrl(url: string, size: number = 150): string {
  return getOptimizedImageUrl(url, {
    width: size,
    height: size,
    quality: 60,
  });
}
