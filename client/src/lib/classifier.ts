/**
 * Municipal Issue Image Classifier - Frontend Utility
 * Calls the ML API server for real model inference
 */

// ML model class names (must match trained model)
export const ML_CLASS_NAMES = [
  "Broken Road Sign Issues",
  "Damaged Electric wires and poles",
  "Damaged concrete structures",
  "Dead Animal Pollution",
  "Fallen trees",
  "Illegal Parking Issues",
  "Littering",
  "Potholes and Road Damage",
  "Vandalism Issues",
];

// Map ML class names to issue types used in the app
export const ML_CLASS_TO_ISSUE_TYPE: Record<string, string> = {
  "Potholes and Road Damage": "POTHOLE",
  "Littering": "GARBAGE",
  "Illegal Parking Issues": "ILLEGAL_PARKING",
  "Broken Road Sign Issues": "DAMAGED_SIGN",
  "Fallen trees": "FALLEN_TREE",
  "Vandalism Issues": "VANDALISM",
  "Dead Animal Pollution": "DEAD_ANIMAL",
  "Damaged concrete structures": "DAMAGED_CONCRETE",
  "Damaged Electric wires and poles": "DAMAGED_ELECTRICAL",
};

// API URLs
import { config } from "./config";

const ML_API_URL = config.api.mlUrl;
const AGENT_API_URL = config.api.agentUrl || "http://localhost:8001";

// Confidence thresholds
const CONFIDENCE_THRESHOLD = 0.70;
const WARNING_THRESHOLD = 0.85;

export interface ClassificationResult {
  isValid: boolean;
  isUnrelated: boolean;
  issueType: string | null;
  className: string | null;
  confidence: number;
  message: string;
  allPredictions: { className: string; probability: number }[];
}

/**
 * Classify an image using GPT-4o vision (Agent Service)
 */
async function classifyWithAgent(imageUrl: string): Promise<ClassificationResult | null> {
  try {
    const response = await fetch(`${AGENT_API_URL}/agent/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return {
          isValid: data.isValid,
          isUnrelated: data.isUnrelated || false,
          issueType: data.issueType,
          className: data.className,
          confidence: data.confidence,
          message: data.message,
          allPredictions: data.allPredictions || [],
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Agent classification error:", error);
    return null;
  }
}

/**
 * Classify an image using the ML API server (runs real TensorFlow model)
 * Falls back to Agent Service (GPT-4o vision) if ML service is unavailable
 */
export async function classifyImage(imageUrl: string): Promise<ClassificationResult> {
  try {
    // Call the ML API server (Flask with TensorFlow)
    const response = await fetch(`${ML_API_URL}/classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return {
          isValid: data.isValid,
          isUnrelated: data.isUnrelated || false,
          issueType: data.issueType,
          className: data.className,
          confidence: data.confidence,
          message: data.message,
          allPredictions: data.allPredictions || [],
        };
      }
    }

    // If ML API fails, try the Express API fallback
    const fallbackResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/classify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      }
    );

    if (fallbackResponse.ok) {
      const data = await fallbackResponse.json();
      if (data.success) {
        return {
          isValid: data.isValid,
          isUnrelated: data.isUnrelated || false,
          issueType: data.issueType,
          className: data.className,
          confidence: data.confidence,
          message: data.message,
          allPredictions: data.allPredictions || [],
        };
      }
    }

    throw new Error("ML/Express API unavailable");
  } catch (error) {
    console.error("ML API error, trying Agent Service:", error);

    // Try Agent Service (GPT-4o vision) as fallback
    const agentResult = await classifyWithAgent(imageUrl);
    if (agentResult) {
      return agentResult;
    }

    // Final fallback: client-side heuristics
    return await classifyImageClientSide(imageUrl);
  }
}

/**
 * Client-side image analysis (basic heuristics until model is deployed)
 * This is a fallback that analyzes image characteristics
 */
async function classifyImageClientSide(imageUrl: string): Promise<ClassificationResult> {
  // Load image and analyze basic characteristics
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      // Create canvas to analyze image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        resolve({
          isValid: false,
          isUnrelated: true,
          issueType: null,
          className: null,
          confidence: 0,
          message: "Could not analyze image. Please upload a clear photo of a municipal issue.",
          allPredictions: [],
        });
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Get image data for basic analysis
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Analyze color distribution (basic heuristic)
      let grayPixels = 0;
      let greenPixels = 0;
      let brownPixels = 0;
      let darkPixels = 0;
      const totalPixels = data.length / 4;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Gray detection (road, concrete, asphalt)
        if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20) {
          grayPixels++;
          if (r < 80) darkPixels++;
        }
        
        // Green detection (trees, vegetation)
        if (g > r * 1.2 && g > b * 1.1) {
          greenPixels++;
        }
        
        // Brown detection (dirt, garbage, rust)
        if (r > g && r > b && g > b * 0.8) {
          brownPixels++;
        }
      }

      const grayRatio = grayPixels / totalPixels;
      const greenRatio = greenPixels / totalPixels;
      const brownRatio = brownPixels / totalPixels;
      const darkRatio = darkPixels / totalPixels;

      // Simple heuristic classification
      let predictedClass: string | null = null;
      let confidence = 0.6;

      if (grayRatio > 0.4 && darkRatio > 0.1) {
        // Likely road-related
        predictedClass = "Potholes and Road Damage";
        confidence = 0.72;
      } else if (greenRatio > 0.3) {
        // Likely vegetation/tree related
        predictedClass = "Fallen trees";
        confidence = 0.68;
      } else if (brownRatio > 0.25) {
        // Likely garbage or dirt
        predictedClass = "Littering/Garbage on Public Places";
        confidence = 0.65;
      } else if (grayRatio > 0.3) {
        // Could be concrete or infrastructure
        predictedClass = "Damaged concrete structures";
        confidence = 0.60;
      }

      if (predictedClass && confidence >= CONFIDENCE_THRESHOLD) {
        const issueType = ML_CLASS_TO_ISSUE_TYPE[predictedClass] || null;
        resolve({
          isValid: true,
          isUnrelated: false,
          issueType,
          className: predictedClass,
          confidence,
          message: confidence >= WARNING_THRESHOLD 
            ? `Detected as ${predictedClass}`
            : `Possibly ${predictedClass}. Please confirm the issue type.`,
          allPredictions: [{ className: predictedClass, probability: confidence }],
        });
      } else {
        // Low confidence - likely unrelated image
        resolve({
          isValid: false,
          isUnrelated: true,
          issueType: null,
          className: null,
          confidence: 0.5,
          message: "This image doesn't appear to show a municipal issue. Please upload a clear photo of the issue.",
          allPredictions: [],
        });
      }
    };

    img.onerror = () => {
      resolve({
        isValid: false,
        isUnrelated: true,
        issueType: null,
        className: null,
        confidence: 0,
        message: "Could not load image. Please try uploading again.",
        allPredictions: [],
      });
    };

    img.src = imageUrl;
  });
}

/**
 * Validate if user-selected issue type matches classification
 */
export function validateIssueType(
  classificationResult: ClassificationResult,
  selectedIssueType: string
): { isValid: boolean; warning?: string } {
  if (!classificationResult.issueType) {
    return { isValid: true };
  }

  if (classificationResult.issueType === selectedIssueType) {
    return { isValid: true };
  }

  if (classificationResult.confidence > WARNING_THRESHOLD) {
    return {
      isValid: false,
      warning: `The image appears to show "${classificationResult.className}" but you selected a different category.`,
    };
  }

  return { isValid: true };
}

/**
 * Generate a description using Agent Service (GPT-4o vision)
 */
async function generateDescriptionWithAgent(
  imageUrl: string,
  issueType: string
): Promise<{ success: boolean; description?: string; error?: string }> {
  try {
    const response = await fetch(`${AGENT_API_URL}/agent/generate-description`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, issue_type: issueType }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return { success: true, description: data.description };
      }
      return { success: false, error: data.error || "Failed to generate description" };
    }
    return { success: false, error: "Agent description service unavailable" };
  } catch (error) {
    console.error("Agent description error:", error);
    return { success: false, error: "Failed to connect to agent service" };
  }
}

/**
 * Generate a description for the issue using Gemini AI
 * Falls back to Agent Service (GPT-4o vision) if ML service is unavailable
 */
export async function generateDescription(
  imageUrl: string,
  issueType: string
): Promise<{ success: boolean; description?: string; error?: string }> {
  try {
    const response = await fetch(`${ML_API_URL}/generate-description`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl, issueType }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return { success: true, description: data.description };
      }
      return { success: false, error: data.error || "Failed to generate description" };
    }

    // ML service unavailable, try Agent Service
    throw new Error("ML description service unavailable");
  } catch (error) {
    console.error("ML description error, trying Agent Service:", error);

    // Try Agent Service (GPT-4o vision) as fallback
    return await generateDescriptionWithAgent(imageUrl, issueType);
  }
}
