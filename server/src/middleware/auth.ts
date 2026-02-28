import { Request, Response, NextFunction } from "express";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient, TABLES, AWS_CONFIG } from "../shared/aws";
import type { UserRole } from "../shared/types";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    role: UserRole;
    municipalityId: string | null;
  };
}

// Cognito JWT verifier (singleton)
let jwtVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getJwtVerifier() {
  if (!jwtVerifier) {
    jwtVerifier = CognitoJwtVerifier.create({
      userPoolId: AWS_CONFIG.cognitoUserPoolId,
      tokenUse: "access",
      clientId: AWS_CONFIG.cognitoClientId,
    });
    console.log("✅ Cognito JWT verifier initialized");
  }
  return jwtVerifier;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        data: null,
        error: "Missing or invalid authorization header",
        timestamp: new Date().toISOString(),
      });
    }

    const token = authHeader.split("Bearer ")[1];

    // Verify JWT with Cognito
    const verifier = getJwtVerifier();
    const payload = await verifier.verify(token);

    const uid = payload.sub;
    const email = (payload as Record<string, unknown>).email as string || "";

    // Get user profile from DynamoDB
    const result = await getDocClient().send(
      new GetCommand({
        TableName: TABLES.USERS,
        Key: { uid },
      })
    );

    const userData = result.Item || null;

    // Map role from stored data
    const storedRole = userData?.role || "USER";
    let mappedRole: UserRole = "USER";

    if (storedRole === "admin" || storedRole === "PLATFORM_MAINTAINER") {
      mappedRole = "PLATFORM_MAINTAINER";
    } else if (
      storedRole === "municipality" ||
      storedRole === "MUNICIPALITY_USER"
    ) {
      mappedRole = "MUNICIPALITY_USER";
    } else {
      mappedRole = "USER";
    }

    req.user = {
      uid,
      email: (userData?.email as string) || email,
      role: mappedRole,
      municipalityId: (userData?.municipalityId as string) || null,
    };

    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({
      success: false,
      data: null,
      error: "Invalid or expired token",
      timestamp: new Date().toISOString(),
    });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: "Authentication required",
        timestamp: new Date().toISOString(),
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        data: null,
        error: "Insufficient permissions",
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}

export function requireMunicipality(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user?.municipalityId) {
    return res.status(403).json({
      success: false,
      data: null,
      error: "Municipality binding required",
      timestamp: new Date().toISOString(),
    });
  }
  next();
}
