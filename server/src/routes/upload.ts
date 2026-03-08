import { Router, Request, Response } from "express";
import type { Router as IRouter } from "express";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client, AWS_CONFIG } from "../shared/aws";

const router: IRouter = Router();

// Generate a presigned upload URL for S3
router.post("/presigned-url", async (req: Request, res: Response) => {
  try {
    const s3 = getS3Client();
    const contentType = req.body?.contentType || "image/jpeg";
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const key = `civiclemma/issues/${timestamp}-${randomSuffix}`;

    const command = new PutObjectCommand({
      Bucket: AWS_CONFIG.s3Bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    const publicUrl = AWS_CONFIG.cloudfrontDomain
      ? `https://${AWS_CONFIG.cloudfrontDomain}/${key}`
      : `https://${AWS_CONFIG.s3Bucket}.s3.amazonaws.com/${key}`;

    res.json({
      success: true,
      data: {
        uploadUrl,
        fileKey: key,
        publicUrl,
        bucket: AWS_CONFIG.s3Bucket,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating S3 presigned URL:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to generate upload signature",
      timestamp: new Date().toISOString(),
    });
  }
});

// Get optimized image URL (CloudFront)
router.get("/optimize", (req: Request, res: Response) => {
  const { url, width, height, quality } = req.query;

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      success: false,
      data: null,
      error: "URL is required",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // If CloudFront is configured, transform the URL
    if (AWS_CONFIG.cloudfrontDomain && url.includes('s3.amazonaws.com')) {
      // Extract key from S3 URL and build CloudFront URL
      const s3UrlParts = url.split('.s3.amazonaws.com/');
      if (s3UrlParts.length === 2) {
        const key = s3UrlParts[1];
        const optimizedUrl = `https://${AWS_CONFIG.cloudfrontDomain}/${key}`;
        return res.json({
          success: true,
          data: { url: optimizedUrl },
          error: null,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Return URL as-is if no optimization is possible
    res.json({
      success: true,
      data: { url },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error optimizing URL:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to optimize URL",
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as uploadRoutes };
