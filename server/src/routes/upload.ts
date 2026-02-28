import { Router, Request, Response } from "express";
import type { Router as IRouter } from "express";
import { v2 as cloudinary } from "cloudinary";

const router: IRouter = Router();

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Generate a signed upload URL
router.post("/signature", async (_req: Request, res: Response) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = "civiclemma/issues";

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
      },
      process.env.CLOUDINARY_API_SECRET || ""
    );

    res.json({
      success: true,
      data: {
        signature,
        timestamp,
        folder,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating Cloudinary signature:", error);
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to generate upload signature",
      timestamp: new Date().toISOString(),
    });
  }
});

// Get optimized image URL
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
    const transformations: string[] = ["f_auto"];

    if (quality) transformations.push(`q_${quality}`);
    if (width) transformations.push(`w_${width}`);
    if (height) transformations.push(`h_${height}`);

    // Transform Cloudinary URL
    if (url.includes("cloudinary.com")) {
      const parts = url.split("/upload/");
      if (parts.length === 2) {
        const optimizedUrl = `${parts[0]}/upload/${transformations.join(",")}/${
          parts[1]
        }`;
        return res.json({
          success: true,
          data: { url: optimizedUrl },
          error: null,
          timestamp: new Date().toISOString(),
        });
      }
    }

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
