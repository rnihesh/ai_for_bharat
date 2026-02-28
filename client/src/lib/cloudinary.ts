// Cloudinary configuration and upload utilities
import { config } from "./config";

const API_BASE_URL = config.api.baseUrl;

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  created_at: string;
}

interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

interface SignatureResponse {
  success: boolean;
  data: {
    signature: string;
    timestamp: number;
    folder: string;
    cloudName: string;
    apiKey: string;
  };
}

/**
 * Get upload signature from backend
 */
async function getUploadSignature(): Promise<SignatureResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/upload/signature`, {
      method: 'POST',
    });
    const data = await response.json();
    if (data.success) {
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error getting signature:', error);
    return null;
  }
}

/**
 * Upload a single image to Cloudinary using signed upload
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  try {
    // Get signature from backend
    const signatureData = await getUploadSignature();
    
    if (!signatureData) {
      return { success: false, error: 'Failed to get upload signature' };
    }

    const { signature, timestamp, folder, cloudName, apiKey } = signatureData.data;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', apiKey);
    formData.append('folder', folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Cloudinary upload failed:', error);
      return { success: false, error: 'Failed to upload image' };
    }

    const data: CloudinaryUploadResponse = await response.json();
    
    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return { success: false, error: 'Failed to upload image' };
  }
}

/**
 * Upload multiple images to Cloudinary
 */
export async function uploadImages(files: File[]): Promise<{ urls: string[]; errors: string[] }> {
  const results = await Promise.all(files.map(uploadImage));
  
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
 * Get optimized image URL
 */
export function getOptimizedImageUrl(
  url: string, 
  options: { width?: number; height?: number; quality?: number } = {}
): string {
  const { width = 800, height, quality = 80 } = options;
  
  // If it's already a Cloudinary URL, transform it
  if (url.includes('cloudinary.com')) {
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      let transforms = `f_auto,q_${quality}`;
      if (width) transforms += `,w_${width}`;
      if (height) transforms += `,h_${height}`;
      return `${parts[0]}/upload/${transforms}/${parts[1]}`;
    }
  }
  
  return url;
}

/**
 * Get thumbnail URL for an image
 */
export function getThumbnailUrl(url: string, size: number = 150): string {
  return getOptimizedImageUrl(url, { width: size, height: size, quality: 60 });
}
