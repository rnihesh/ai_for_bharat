import { Request, Response, NextFunction } from "express";
import { getAdminAuth, getAdminDb, COLLECTIONS } from "../shared/firebase";
import type { UserRole } from "../shared/types";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    role: UserRole;
    municipalityId: string | null;
  };
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
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);

    // Get user profile from Firestore to get the actual role
    const db = getAdminDb();
    const userDoc = await db
      .collection(COLLECTIONS.USERS)
      .doc(decodedToken.uid)
      .get();
    const userData = userDoc.exists ? userDoc.data() : null;

    // Map role names (Firestore uses lowercase, types may use uppercase)
    const firestoreRole = userData?.role || "user";
    let mappedRole: UserRole = "USER";

    if (firestoreRole === "admin" || firestoreRole === "PLATFORM_MAINTAINER") {
      mappedRole = "PLATFORM_MAINTAINER";
    } else if (
      firestoreRole === "municipality" ||
      firestoreRole === "MUNICIPALITY_USER"
    ) {
      mappedRole = "MUNICIPALITY_USER";
    } else {
      mappedRole = "USER";
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || "",
      role: mappedRole,
      municipalityId: userData?.municipalityId || null,
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
