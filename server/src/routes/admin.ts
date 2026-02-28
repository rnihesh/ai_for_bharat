import { Router, Response } from "express";
import type { Router as IRouter } from "express";
import { getAdminDb, COLLECTIONS } from "../shared/firebase";
import {
  createMunicipalitySchema,
  updateMunicipalitySchema,
  paginationSchema,
} from "../shared/validation";
import {
  authMiddleware,
  requireRole,
  AuthenticatedRequest,
} from "../middleware/auth";
import { getMunicipalityBounds } from "../services/location";

const router: IRouter = Router();

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(requireRole("PLATFORM_MAINTAINER"));

// ============================================
// MUNICIPALITY MANAGEMENT
// ============================================

// Get all municipalities (with pagination and filters)
router.get(
  "/municipalities",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { state, district, search } = req.query;

      let query = db.collection(COLLECTIONS.MUNICIPALITIES).orderBy("name");

      if (state) {
        query = query.where("state", "==", state);
      }
      if (district) {
        query = query.where("district", "==", district);
      }

      let allDocs;
      if (search && typeof search === "string" && search.trim()) {
        const allSnapshot = await query.get();
        const searchLower = search.toLowerCase().trim();
        allDocs = allSnapshot.docs.filter((doc) => {
          const data = doc.data();
          return (
            data.name?.toLowerCase().includes(searchLower) ||
            data.district?.toLowerCase().includes(searchLower) ||
            data.state?.toLowerCase().includes(searchLower)
          );
        });
      } else {
        const snapshot = await query
          .limit(pageSize)
          .offset((page - 1) * pageSize)
          .get();
        allDocs = null;
        
        const municipalities = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        }));

        const countSnapshot = await db
          .collection(COLLECTIONS.MUNICIPALITIES)
          .count()
          .get();
        const total = countSnapshot.data().count;

        return res.json({
          success: true,
          data: {
            items: municipalities,
            total,
            page,
            pageSize,
            hasMore: (page - 1) * pageSize + municipalities.length < total,
          },
          error: null,
          timestamp: new Date().toISOString(),
        });
      }

      // Paginate filtered results
      const total = allDocs.length;
      const startIndex = (page - 1) * pageSize;
      const paginatedDocs = allDocs.slice(startIndex, startIndex + pageSize);
      
      const municipalities = paginatedDocs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      }));

      res.json({
        success: true,
        data: {
          items: municipalities,
          total,
          page,
          pageSize,
          hasMore: startIndex + municipalities.length < total,
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Error fetching municipalities:",
        (error as any)?.message || String(error)
      );
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to fetch municipalities",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Create a new municipality
router.post(
  "/municipalities",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();
      const input = createMunicipalitySchema.parse(req.body);
      const now = new Date();

      const municipalityData = {
        ...input,
        score: 100,
        totalIssues: 0,
        resolvedIssues: 0,
        avgResolutionTime: null,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await db
        .collection(COLLECTIONS.MUNICIPALITIES)
        .add(municipalityData);

      res.status(201).json({
        success: true,
        data: { id: docRef.id, ...municipalityData },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error(
        "Error creating municipality:",
        error?.message || String(error)
      );

      if (error.name === "ZodError") {
        return res.status(400).json({
          success: false,
          data: null,
          error: error.errors,
          timestamp: new Date().toISOString(),
        });
      }

      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to create municipality",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Update a municipality
router.put(
  "/municipalities/:id",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();
      const { id } = req.params;
      const input = updateMunicipalitySchema.parse(req.body);

      const docRef = db.collection(COLLECTIONS.MUNICIPALITIES).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Municipality not found",
          timestamp: new Date().toISOString(),
        });
      }

      await docRef.update({
        ...input,
        updatedAt: new Date(),
      });

      const updated = await docRef.get();

      res.json({
        success: true,
        data: { id: updated.id, ...updated.data() },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error(
        "Error updating municipality:",
        error?.message || String(error)
      );

      if (error.name === "ZodError") {
        return res.status(400).json({
          success: false,
          data: null,
          error: error.errors,
          timestamp: new Date().toISOString(),
        });
      }

      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to update municipality",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Auto-regenerate bounds for a municipality
router.post(
  "/municipalities/:id/regenerate-bounds",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();
      const { id } = req.params;

      const docRef = db.collection(COLLECTIONS.MUNICIPALITIES).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Municipality not found",
          timestamp: new Date().toISOString(),
        });
      }

      const municipality = doc.data()!;

      // Get new bounds from Google Maps
      const newBounds = await getMunicipalityBounds(
        municipality.name,
        municipality.district,
        municipality.state
      );

      await docRef.update({
        bounds: newBounds,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        data: {
          id,
          name: municipality.name,
          bounds: newBounds,
          message: `Bounds updated: N:${newBounds.north.toFixed(
            4
          )} S:${newBounds.south.toFixed(4)} E:${newBounds.east.toFixed(
            4
          )} W:${newBounds.west.toFixed(4)}`,
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Error regenerating bounds:",
        (error as any)?.message || String(error)
      );
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to regenerate bounds",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Delete a municipality
router.delete(
  "/municipalities/:id",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();
      const { id } = req.params;

      const docRef = db.collection(COLLECTIONS.MUNICIPALITIES).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Municipality not found",
          timestamp: new Date().toISOString(),
        });
      }

      // Check if there are any linked issues
      const issuesSnapshot = await db
        .collection(COLLECTIONS.ISSUES)
        .where("municipalityId", "==", id)
        .limit(1)
        .get();

      if (!issuesSnapshot.empty) {
        return res.status(400).json({
          success: false,
          data: null,
          error:
            "Cannot delete municipality with existing issues. Reassign issues first.",
          timestamp: new Date().toISOString(),
        });
      }

      await docRef.delete();

      res.json({
        success: true,
        data: { deleted: true },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Error deleting municipality:",
        (error as any)?.message || String(error)
      );
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to delete municipality",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// ============================================
// MUNICIPALITY REGISTRATION REQUESTS
// ============================================

// Get pending registration requests
router.get(
  "/registrations",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { status = "PENDING" } = req.query;

      const snapshot = await db
        .collection("municipality_registrations")
        .where("status", "==", status)
        .get();

      let registrations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      }));

      registrations.sort((a: any, b: any) => {
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });

      const total = registrations.length;

      registrations = registrations.slice(
        (page - 1) * pageSize,
        page * pageSize
      );

      res.json({
        success: true,
        data: {
          items: registrations,
          total,
          page,
          pageSize,
          hasMore: (page - 1) * pageSize + registrations.length < total,
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Error fetching registrations:",
        (error as any)?.message || String(error)
      );
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to fetch registrations",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Approve a registration request
router.post(
  "/registrations/:id/approve",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();
      const { id } = req.params;
      const { bounds } = req.body;

      const regRef = db.collection("municipality_registrations").doc(id);
      const regDoc = await regRef.get();

      if (!regDoc.exists) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Registration request not found",
          timestamp: new Date().toISOString(),
        });
      }

      const registration = regDoc.data()!;

      if (registration.status !== "PENDING") {
        return res.status(400).json({
          success: false,
          data: null,
          error: "Registration has already been processed",
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date();

      let municipalityBounds = bounds || registration.bounds;

      if (
        !municipalityBounds ||
        (municipalityBounds.north === 0 && municipalityBounds.south === 0)
      ) {
        console.log(
          `Auto-generating bounds for ${registration.municipalityName}, ${registration.district}, ${registration.state}`
        );
        municipalityBounds = await getMunicipalityBounds(
          registration.municipalityName,
          registration.district,
          registration.state
        );
      }

      const municipalityData = {
        name: registration.municipalityName,
        type: registration.municipalityType || "MUNICIPALITY",
        state: registration.state,
        district: registration.district,
        bounds: municipalityBounds,
        score: 100,
        totalIssues: 0,
        resolvedIssues: 0,
        avgResolutionTime: null,
        createdAt: now,
        updatedAt: now,
      };

      const municipalityRef = await db
        .collection(COLLECTIONS.MUNICIPALITIES)
        .add(municipalityData);

      if (registration.userId) {
        await db.collection(COLLECTIONS.USERS).doc(registration.userId).update({
          role: "municipality",
          municipalityId: municipalityRef.id,
          updatedAt: now,
        });
      }

      await regRef.update({
        status: "APPROVED",
        approvedBy: req.user!.uid,
        approvedAt: now,
        municipalityId: municipalityRef.id,
        updatedAt: now,
      });

      res.json({
        success: true,
        data: {
          registration: { id, status: "APPROVED" },
          municipality: { id: municipalityRef.id, ...municipalityData },
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Error approving registration:",
        (error as any)?.message || String(error)
      );
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to approve registration",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Reject a registration request
router.post(
  "/registrations/:id/reject",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          data: null,
          error: "Rejection reason is required",
          timestamp: new Date().toISOString(),
        });
      }

      const regRef = db.collection("municipality_registrations").doc(id);
      const regDoc = await regRef.get();

      if (!regDoc.exists) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Registration request not found",
          timestamp: new Date().toISOString(),
        });
      }

      const registration = regDoc.data()!;

      if (registration.status !== "PENDING") {
        return res.status(400).json({
          success: false,
          data: null,
          error: "Registration has already been processed",
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date();

      await regRef.update({
        status: "REJECTED",
        rejectionReason: reason,
        rejectedBy: req.user!.uid,
        rejectedAt: now,
        updatedAt: now,
      });

      res.json({
        success: true,
        data: { id, status: "REJECTED", reason },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Error rejecting registration:",
        (error as any)?.message || String(error)
      );
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to reject registration",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// ============================================
// USER MANAGEMENT
// ============================================

// Get all users
router.get("/users", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getAdminDb();
    const { page, pageSize } = paginationSchema.parse(req.query);
    const { role, search } = req.query;

    let query = db.collection(COLLECTIONS.USERS).orderBy("createdAt", "desc");

    if (role && typeof role === "string") {
      query = query.where("role", "==", role);
    }

    let allDocs;
    if (search && typeof search === "string" && search.trim()) {
      const allSnapshot = await query.get();
      const searchLower = search.toLowerCase().trim();
      allDocs = allSnapshot.docs.filter((doc) => {
        const data = doc.data();
        return (
          data.email?.toLowerCase().includes(searchLower) ||
          data.displayName?.toLowerCase().includes(searchLower)
        );
      });
    } else {
      const snapshot = await query
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .get();

      const users = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        lastLogin: doc.data().lastLogin?.toDate(),
      }));

      let total;
      if (role && typeof role === "string") {
        const countSnapshot = await db
          .collection(COLLECTIONS.USERS)
          .where("role", "==", role)
          .count()
          .get();
        total = countSnapshot.data().count;
      } else {
        const countSnapshot = await db.collection(COLLECTIONS.USERS).count().get();
        total = countSnapshot.data().count;
      }

      return res.json({
        success: true,
        data: {
          items: users,
          total,
          page,
          pageSize,
          hasMore: (page - 1) * pageSize + users.length < total,
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    }

    const total = allDocs.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedDocs = allDocs.slice(startIndex, startIndex + pageSize);

    const users = paginatedDocs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      lastLogin: doc.data().lastLogin?.toDate(),
    }));

    res.json({
      success: true,
      data: {
        items: users,
        total,
        page,
        pageSize,
        hasMore: startIndex + users.length < total,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching users:", (error as any)?.message || String(error));
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch users",
      timestamp: new Date().toISOString(),
    });
  }
});

// Update user role
router.put(
  "/users/:id/role",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();
      const { id } = req.params;
      const { role, municipalityId } = req.body;

      if (!["user", "municipality", "admin"].includes(role)) {
        return res.status(400).json({
          success: false,
          data: null,
          error: "Invalid role",
          timestamp: new Date().toISOString(),
        });
      }

      if (role === "municipality" && !municipalityId) {
        return res.status(400).json({
          success: false,
          data: null,
          error: "Municipality ID is required for municipality role",
          timestamp: new Date().toISOString(),
        });
      }

      const userRef = db.collection(COLLECTIONS.USERS).doc(id);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "User not found",
          timestamp: new Date().toISOString(),
        });
      }

      await userRef.update({
        role,
        municipalityId: role === "municipality" ? municipalityId : null,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        data: {
          id,
          role,
          municipalityId: role === "municipality" ? municipalityId : null,
        },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Error updating user role:",
        (error as any)?.message || String(error)
      );
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to update user role",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// ============================================
// ISSUE MANAGEMENT (Admin)
// ============================================

// Update an issue
router.put(
  "/issues/:id",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();
      const { id } = req.params;
      const { description, status, type, location, imageUrls } = req.body;

      const docRef = db.collection(COLLECTIONS.ISSUES).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Issue not found",
          timestamp: new Date().toISOString(),
        });
      }

      const issueData = doc.data()!;
      const previousStatus = issueData.status;
      const municipalityId = issueData.municipalityId;

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (description !== undefined) {
        updateData.description = description;
      }
      if (type !== undefined) {
        updateData.type = type;
        updateData.classifiedType = type;
      }
      if (location !== undefined) {
        updateData.location = {
          ...issueData.location,
          ...location,
        };
      }
      if (imageUrls !== undefined && Array.isArray(imageUrls)) {
        updateData.imageUrls = imageUrls;
      }
      if (status !== undefined) {
        if (!["OPEN", "CLOSED"].includes(status)) {
          return res.status(400).json({
            success: false,
            data: null,
            error: "Invalid status. Must be OPEN or CLOSED",
            timestamp: new Date().toISOString(),
          });
        }
        updateData.status = status;
      }

      await docRef.update(updateData);

      if (status && status !== previousStatus && municipalityId) {
        const muniRef = db.collection(COLLECTIONS.MUNICIPALITIES).doc(municipalityId);
        const muniDoc = await muniRef.get();
        if (muniDoc.exists) {
          const muniData = muniDoc.data()!;
          let resolvedChange = 0;

          if (status === "CLOSED" && previousStatus !== "CLOSED") {
            resolvedChange = 1;
          } else if (status !== "CLOSED" && previousStatus === "CLOSED") {
            resolvedChange = -1;
          }

          if (resolvedChange !== 0) {
            await muniRef.update({
              resolvedIssues: Math.max(0, (muniData.resolvedIssues || 0) + resolvedChange),
              updatedAt: new Date(),
            });
          }
        }
      }

      res.json({
        success: true,
        data: { id, ...updateData },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error updating issue:", (error as any)?.message || String(error));
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to update issue",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Delete an issue
router.delete(
  "/issues/:id",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = getAdminDb();
      const { id } = req.params;

      const docRef = db.collection(COLLECTIONS.ISSUES).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Issue not found",
          timestamp: new Date().toISOString(),
        });
      }

      const issueData = doc.data()!;
      const municipalityId = issueData.municipalityId;

      await docRef.delete();

      if (municipalityId) {
        const muniRef = db.collection(COLLECTIONS.MUNICIPALITIES).doc(municipalityId);
        const muniDoc = await muniRef.get();
        if (muniDoc.exists) {
          const muniData = muniDoc.data()!;
          const wasResolved = issueData.status === "CLOSED";
          await muniRef.update({
            totalIssues: Math.max(0, (muniData.totalIssues || 1) - 1),
            resolvedIssues: wasResolved 
              ? Math.max(0, (muniData.resolvedIssues || 1) - 1) 
              : muniData.resolvedIssues || 0,
            updatedAt: new Date(),
          });
        }
      }

      res.json({
        success: true,
        data: { deleted: true },
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error deleting issue:", (error as any)?.message || String(error));
      res.status(500).json({
        success: false,
        data: null,
        error: "Failed to delete issue",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// ============================================
// DASHBOARD STATS
// ============================================

// Get admin dashboard stats (enhanced with analytics)
router.get("/stats", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getAdminDb();

    const [usersCount, municipalitiesCount, issuesCount, pendingRegistrations] =
      await Promise.all([
        db.collection(COLLECTIONS.USERS).count().get(),
        db.collection(COLLECTIONS.MUNICIPALITIES).count().get(),
        db.collection(COLLECTIONS.ISSUES).count().get(),
        db
          .collection("municipality_registrations")
          .where("status", "==", "PENDING")
          .count()
          .get(),
      ]);

    // Get all issues for detailed analytics
    const issuesSnapshot = await db.collection(COLLECTIONS.ISSUES).get();

    const statusBreakdown: Record<string, number> = {
      OPEN: 0,
      CLOSED: 0,
    };

    const issuesByType: Record<string, number> = {};
    const issuesByMunicipality: Record<string, { count: number; name?: string }> = {};
    const issuesLast7Days: Record<string, number> = {};
    const issuesLast30Days: Record<string, number> = {};

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      issuesLast7Days[dateStr] = 0;
    }

    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      issuesLast30Days[dateStr] = 0;
    }

    let totalResolutionTime = 0;
    let resolvedCount = 0;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    issuesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const status = data.status;
      const type = data.type;
      const municipalityId = data.municipalityId;
      const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
      const closedAt = data.closedAt?.toDate?.() || (data.closedAt ? new Date(data.closedAt) : null);

      // Status breakdown
      if (status === "OPEN") {
        statusBreakdown.OPEN++;
      } else if (status === "CLOSED") {
        statusBreakdown.CLOSED++;
      }

      // Type breakdown
      if (type) {
        issuesByType[type] = (issuesByType[type] || 0) + 1;
      }

      // Municipality breakdown
      if (municipalityId) {
        if (!issuesByMunicipality[municipalityId]) {
          issuesByMunicipality[municipalityId] = { count: 0 };
        }
        issuesByMunicipality[municipalityId].count++;
      }

      // Issues trend (last 7 days)
      if (createdAt >= sevenDaysAgo) {
        const dateStr = createdAt.toISOString().split('T')[0];
        if (issuesLast7Days[dateStr] !== undefined) {
          issuesLast7Days[dateStr]++;
        }
      }

      // Issues trend (last 30 days)
      if (createdAt >= thirtyDaysAgo) {
        const dateStr = createdAt.toISOString().split('T')[0];
        if (issuesLast30Days[dateStr] !== undefined) {
          issuesLast30Days[dateStr]++;
        }
      }

      // Resolution time calculation
      if (status === "CLOSED" && closedAt && createdAt) {
        const resolutionTime = closedAt.getTime() - createdAt.getTime();
        if (resolutionTime > 0) {
          totalResolutionTime += resolutionTime;
          resolvedCount++;
        }
      }
    });

    // Get municipality names for top municipalities
    const topMunicipalityIds = Object.entries(issuesByMunicipality)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id]) => id);

    if (topMunicipalityIds.length > 0) {
      const muniPromises = topMunicipalityIds.map(id =>
        db.collection(COLLECTIONS.MUNICIPALITIES).doc(id).get()
      );
      const muniDocs = await Promise.all(muniPromises);
      muniDocs.forEach((doc) => {
        if (doc.exists && issuesByMunicipality[doc.id]) {
          issuesByMunicipality[doc.id].name = doc.data()?.name || "Unknown";
        }
      });
    }

    // Calculate average resolution time (in hours)
    const avgResolutionTimeHours = resolvedCount > 0
      ? Math.round(totalResolutionTime / resolvedCount / (1000 * 60 * 60))
      : 0;

    // Resolution rate
    const totalIssues = issuesSnapshot.size;
    const resolutionRate = totalIssues > 0
      ? Math.round((statusBreakdown.CLOSED / totalIssues) * 100)
      : 0;

    // Format issues trend for frontend
    const issuesTrend = Object.entries(issuesLast7Days).map(([date, count]) => ({
      date,
      count,
      label: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
    }));

    const issuesTrend30Days = Object.entries(issuesLast30Days).map(([date, count]) => ({
      date,
      count,
    }));

    // Top 5 municipalities by issue count
    const topMunicipalities = Object.entries(issuesByMunicipality)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id, data]) => ({
        id,
        name: data.name || id,
        issueCount: data.count,
      }));

    // Check ML service health
    let mlServiceStatus = "unknown";
    try {
      const mlResponse = await fetch(`${process.env.ML_SERVICE_URL || "http://localhost:8000"}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (mlResponse.ok) {
        mlServiceStatus = "healthy";
      } else {
        mlServiceStatus = "unhealthy";
      }
    } catch {
      mlServiceStatus = "offline";
    }

    res.json({
      success: true,
      data: {
        // Basic stats
        totalUsers: usersCount.data().count,
        totalMunicipalities: municipalitiesCount.data().count,
        totalIssues: issuesCount.data().count,
        pendingRegistrations: pendingRegistrations.data().count,
        issuesByStatus: statusBreakdown,

        // Enhanced analytics
        issuesByType,
        topMunicipalities,
        issuesTrend,
        issuesTrend30Days,

        // Performance metrics
        resolutionRate,
        avgResolutionTimeHours,

        // ML Service status
        mlServiceStatus,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Error fetching admin stats:",
      (error as any)?.message || String(error)
    );
    res.status(500).json({
      success: false,
      data: null,
      error: "Failed to fetch admin stats",
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as adminRoutes };
