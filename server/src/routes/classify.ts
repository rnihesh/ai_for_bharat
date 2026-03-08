import { Router, Request, Response as ExpressResponse } from "express";
import type { Router as IRouter } from "express";
import {
  ML_CLASS_TO_ISSUE_TYPE,
  ISSUE_TYPE_LABELS,
  IssueType,
} from "../shared/types";
import { AWS_CONFIG } from "../shared/aws";

const router: IRouter = Router();

/**
 * Validate that an image URL points to a trusted domain (S3 or CloudFront).
 * Blocks SSRF attacks by preventing fetches to arbitrary/internal URLs.
 */
function isAllowedImageUrl(imageUrl: string): boolean {
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    // Allow S3 bucket URLs
    if (host.endsWith(".s3.amazonaws.com") || host.endsWith(".s3.ap-south-1.amazonaws.com")) return true;
    // Allow CloudFront
    if (AWS_CONFIG.cloudfrontDomain && host === AWS_CONFIG.cloudfrontDomain.toLowerCase()) return true;
    if (host.endsWith(".cloudfront.net")) return true;
    return false;
  } catch {
    return false;
  }
}

// ML model class names (alphabetically sorted - matches model output order)
const ML_CLASS_NAMES = [
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

// Confidence thresholds
const CONFIDENCE_THRESHOLD = 0.7;
const WARNING_THRESHOLD = 0.85;

interface ClassifyRequest {
  imageUrl: string;
}

interface ClassifyResponse {
  success: boolean;
  isValid: boolean;
  issueType: IssueType | null;
  className: string | null;
  confidence: number;
  message: string;
  allPredictions?: { className: string; probability: number }[];
}

/**
 * POST /api/classify
 * Classify an image to identify municipal issues
 *
 * For now, this uses image analysis heuristics.
 * When the TensorFlow model is deployed, this will use the trained model.
 */
router.post(
  "/",
  async (
    req: Request<object, ClassifyResponse, ClassifyRequest>,
    res: ExpressResponse<ClassifyResponse>
  ) => {
    try {
      const { imageUrl } = req.body;

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          isValid: false,
          issueType: null,
          className: null,
          confidence: 0,
          message: "Image URL is required",
        });
      }

      if (!isAllowedImageUrl(imageUrl)) {
        return res.status(400).json({
          success: false,
          isValid: false,
          issueType: null,
          className: null,
          confidence: 0,
          message: "Invalid image URL. Only images uploaded to our platform are accepted.",
        });
      }

      // Attempt to fetch and analyze the image
      const result = await analyzeImage(imageUrl);

      return res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("Classification error:", error);
      return res.status(500).json({
        success: false,
        isValid: true, // Allow submission even if classification fails
        issueType: null,
        className: null,
        confidence: 0,
        message:
          "Classification service unavailable. Please select issue type manually.",
      });
    }
  }
);

/**
 * GET /api/classify/issue-types
 * Get list of all valid issue types that can be classified
 */
router.get("/issue-types", (_req: Request, res: ExpressResponse) => {
  const issueTypes = ML_CLASS_NAMES.map((className) => ({
    className,
    issueType: ML_CLASS_TO_ISSUE_TYPE[className],
    label: ISSUE_TYPE_LABELS[ML_CLASS_TO_ISSUE_TYPE[className] as IssueType],
  }));

  res.json({
    success: true,
    issueTypes,
    count: issueTypes.length,
  });
});

/**
 * Analyze image using basic heuristics
 * This is a placeholder until the TensorFlow model is deployed
 */
async function analyzeImage(
  imageUrl: string
): Promise<Omit<ClassifyResponse, "success">> {
  try {
    // Fetch image to verify it exists
    const response = await fetch(imageUrl, { method: "HEAD" });

    if (!response.ok) {
      return {
        isValid: false,
        issueType: null,
        className: null,
        confidence: 0,
        message: "Could not access the image. Please try uploading again.",
      };
    }

    // Check content type
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.startsWith("image/")) {
      return {
        isValid: false,
        issueType: null,
        className: null,
        confidence: 0,
        message: "The uploaded file is not a valid image.",
      };
    }

    // For now, return a result that lets the user select the type
    // The frontend will do client-side analysis or call the ML API
    return {
      isValid: true,
      issueType: null,
      className: null,
      confidence: 0,
      message:
        "Image validated. Please select the issue type or wait for ML classification.",
    };
  } catch (error) {
    console.error("Image analysis error:", error);
    return {
      isValid: true, // Allow submission even if analysis fails
      issueType: null,
      className: null,
      confidence: 0,
      message: "Could not analyze image. Please select the issue type manually.",
    };
  }
}

export { router as classifyRoutes };
