import { Router, Response } from "express";
import type { Router as IRouter } from "express";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { getDocClient, TABLES, GSI } from "../shared/aws";
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

// ID generation helpers
function generateMunicipalityId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `MUN-${timestamp}-${randomPart}`.toUpperCase();
}

function generateRegistrationId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `REG-${timestamp}-${randomPart}`.toUpperCase();
}

// ============================================
// MUNICIPALITY MANAGEMENT
// ============================================

// Get all municipalities (with pagination and filters)
router.get(
  "/municipalities",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const client = getDocClient();
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { state, district, search } = req.query;

      // Use GSI sorted by name for ordered listing
      const result = await client.send(new QueryCommand({
        TableName: TABLES.MUNICIPALITIES,
        IndexName: GSI.MUNICIPALITIES_BY_NAME,
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': '_pk' },
        ExpressionAttributeValues: { ':pk': 'ALL' },
        ScanIndexForward: true,
      }));

      let allItems = result.Items || [];

      // Apply filters
      if (state && typeof state === 'string') {
        allItems = allItems.filter((item) => item.state === state);
      }
      if (district && typeof district === 'string') {
        allItems = allItems.filter((item) => item.district === district);
      }
      if (search && typeof search === 'string' && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        allItems = allItems.filter((item) =>
          item.name?.toLowerCase().includes(searchLower) ||
          item.district?.toLowerCase().includes(searchLower) ||
          item.state?.toLowerCase().includes(searchLower)
        );
      }

      const total = allItems.length;
      const startIndex = (page - 1) * pageSize;
      const pageItems = allItems.slice(startIndex, startIndex + pageSize);

      const municipalities = pageItems.map((item) => ({
        id: item.municipalityId,
        ...item,
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
      const client = getDocClient();
      const input = createMunicipalitySchema.parse(req.body);
      const now = new Date().toISOString();
      const municipalityId = generateMunicipalityId();

      const municipalityData = {
        municipalityId,
        _pk: 'ALL',
        ...input,
        score: 100,
        totalIssues: 0,
        resolvedIssues: 0,
        avgResolutionTime: null,
        createdAt: now,
        updatedAt: now,
      };

      await client.send(new PutCommand({
        TableName: TABLES.MUNICIPALITIES,
        Item: municipalityData,
      }));

      res.status(201).json({
        success: true,
        data: { id: municipalityId, ...municipalityData },
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
      const client = getDocClient();
      const { id } = req.params;
      const input = updateMunicipalitySchema.parse(req.body);

      // Check if municipality exists
      const getResult = await client.send(new GetCommand({
        TableName: TABLES.MUNICIPALITIES,
        Key: { municipalityId: id },
      }));

      if (!getResult.Item) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Municipality not found",
          timestamp: new Date().toISOString(),
        });
      }

      // Build update expression dynamically
      const expressionParts: string[] = [];
      const expressionValues: Record<string, unknown> = {};
      const expressionNames: Record<string, string> = {};

      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined) {
          const attrName = `#${key}`;
          const attrValue = `:${key}`;
          expressionNames[attrName] = key;
          expressionValues[attrValue] = value;
          expressionParts.push(`${attrName} = ${attrValue}`);
        }
      });

      expressionParts.push('updatedAt = :updatedAt');
      expressionValues[':updatedAt'] = new Date().toISOString();

      await client.send(new UpdateCommand({
        TableName: TABLES.MUNICIPALITIES,
        Key: { municipalityId: id },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeValues: expressionValues,
        ...(Object.keys(expressionNames).length > 0
          ? { ExpressionAttributeNames: expressionNames }
          : {}),
      }));

      // Fetch updated item
      const updatedResult = await client.send(new GetCommand({
        TableName: TABLES.MUNICIPALITIES,
        Key: { municipalityId: id },
      }));

      res.json({
        success: true,
        data: { id, ...updatedResult.Item },
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
      const client = getDocClient();
      const { id } = req.params;

      const getResult = await client.send(new GetCommand({
        TableName: TABLES.MUNICIPALITIES,
        Key: { municipalityId: id },
      }));

      if (!getResult.Item) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Municipality not found",
          timestamp: new Date().toISOString(),
        });
      }

      const municipality = getResult.Item;

      // Get new bounds from Google Maps
      const newBounds = await getMunicipalityBounds(
        municipality.name,
        municipality.district,
        municipality.state
      );

      await client.send(new UpdateCommand({
        TableName: TABLES.MUNICIPALITIES,
        Key: { municipalityId: id },
        UpdateExpression: 'SET bounds = :bounds, updatedAt = :now',
        ExpressionAttributeValues: {
          ':bounds': newBounds,
          ':now': new Date().toISOString(),
        },
      }));

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
      const client = getDocClient();
      const { id } = req.params;

      const getResult = await client.send(new GetCommand({
        TableName: TABLES.MUNICIPALITIES,
        Key: { municipalityId: id },
      }));

      if (!getResult.Item) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Municipality not found",
          timestamp: new Date().toISOString(),
        });
      }

      // Check if there are any linked issues
      const issuesResult = await client.send(new QueryCommand({
        TableName: TABLES.ISSUES,
        IndexName: GSI.ISSUES_BY_MUNICIPALITY,
        KeyConditionExpression: 'municipalityId = :mid',
        ExpressionAttributeValues: { ':mid': id },
        Limit: 1,
      }));

      if (issuesResult.Items && issuesResult.Items.length > 0) {
        return res.status(400).json({
          success: false,
          data: null,
          error:
            "Cannot delete municipality with existing issues. Reassign issues first.",
          timestamp: new Date().toISOString(),
        });
      }

      await client.send(new DeleteCommand({
        TableName: TABLES.MUNICIPALITIES,
        Key: { municipalityId: id },
      }));

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
      const client = getDocClient();
      const { page, pageSize } = paginationSchema.parse(req.query);
      const { status = "PENDING" } = req.query;

      const result = await client.send(new QueryCommand({
        TableName: TABLES.MUNICIPALITY_REGISTRATIONS,
        IndexName: GSI.REGISTRATIONS_BY_STATUS,
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status as string },
        ScanIndexForward: false,
      }));

      let registrations = (result.Items || []).map((item) => ({
        id: item.registrationId,
        ...item,
      }));

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
      const client = getDocClient();
      const { id } = req.params;
      const { bounds } = req.body;

      const getResult = await client.send(new GetCommand({
        TableName: TABLES.MUNICIPALITY_REGISTRATIONS,
        Key: { registrationId: id },
      }));

      if (!getResult.Item) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Registration request not found",
          timestamp: new Date().toISOString(),
        });
      }

      const registration = getResult.Item;

      if (registration.status !== "PENDING") {
        return res.status(400).json({
          success: false,
          data: null,
          error: "Registration has already been processed",
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date().toISOString();
      const municipalityId = generateMunicipalityId();

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
        municipalityId,
        _pk: 'ALL',
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

      // Create the municipality
      await client.send(new PutCommand({
        TableName: TABLES.MUNICIPALITIES,
        Item: municipalityData,
      }));

      // Update user role if userId is present
      if (registration.userId) {
        await client.send(new UpdateCommand({
          TableName: TABLES.USERS,
          Key: { uid: registration.userId },
          UpdateExpression: 'SET #role = :role, municipalityId = :mid, updatedAt = :now',
          ExpressionAttributeNames: { '#role': 'role' },
          ExpressionAttributeValues: {
            ':role': 'municipality',
            ':mid': municipalityId,
            ':now': now,
          },
        }));
      }

      // Update registration status
      await client.send(new UpdateCommand({
        TableName: TABLES.MUNICIPALITY_REGISTRATIONS,
        Key: { registrationId: id },
        UpdateExpression: 'SET #status = :status, approvedBy = :approvedBy, approvedAt = :approvedAt, municipalityId = :mid, updatedAt = :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'APPROVED',
          ':approvedBy': req.user!.uid,
          ':approvedAt': now,
          ':mid': municipalityId,
          ':now': now,
        },
      }));

      res.json({
        success: true,
        data: {
          registration: { id, status: "APPROVED" },
          municipality: { id: municipalityId, ...municipalityData },
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
      const client = getDocClient();
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

      const getResult = await client.send(new GetCommand({
        TableName: TABLES.MUNICIPALITY_REGISTRATIONS,
        Key: { registrationId: id },
      }));

      if (!getResult.Item) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Registration request not found",
          timestamp: new Date().toISOString(),
        });
      }

      const registration = getResult.Item;

      if (registration.status !== "PENDING") {
        return res.status(400).json({
          success: false,
          data: null,
          error: "Registration has already been processed",
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date().toISOString();

      await client.send(new UpdateCommand({
        TableName: TABLES.MUNICIPALITY_REGISTRATIONS,
        Key: { registrationId: id },
        UpdateExpression: 'SET #status = :status, rejectionReason = :reason, rejectedBy = :rejectedBy, rejectedAt = :rejectedAt, updatedAt = :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'REJECTED',
          ':reason': reason,
          ':rejectedBy': req.user!.uid,
          ':rejectedAt': now,
          ':now': now,
        },
      }));

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
    const client = getDocClient();
    const { page, pageSize } = paginationSchema.parse(req.query);
    const { role, search } = req.query;

    let allItems: Record<string, unknown>[];

    if (role && typeof role === 'string') {
      // Use GSI to filter by role
      const result = await client.send(new QueryCommand({
        TableName: TABLES.USERS,
        IndexName: GSI.USERS_BY_ROLE,
        KeyConditionExpression: '#role = :role',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':role': role },
        ScanIndexForward: false,
      }));
      allItems = result.Items || [];
    } else {
      // Scan all users
      const result = await client.send(new ScanCommand({
        TableName: TABLES.USERS,
      }));
      allItems = (result.Items || []).sort((a, b) => {
        const aDate = a.createdAt as string || '';
        const bDate = b.createdAt as string || '';
        return bDate.localeCompare(aDate);
      });
    }

    // Apply search filter in memory
    if (search && typeof search === 'string' && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      allItems = allItems.filter((item) =>
        (item.email as string)?.toLowerCase().includes(searchLower) ||
        (item.displayName as string)?.toLowerCase().includes(searchLower)
      );
    }

    const total = allItems.length;
    const startIndex = (page - 1) * pageSize;
    const pageItems = allItems.slice(startIndex, startIndex + pageSize);

    const users = pageItems.map((item) => ({
      id: item.uid,
      ...item,
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
      const client = getDocClient();
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

      const getResult = await client.send(new GetCommand({
        TableName: TABLES.USERS,
        Key: { uid: id },
      }));

      if (!getResult.Item) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "User not found",
          timestamp: new Date().toISOString(),
        });
      }

      await client.send(new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { uid: id },
        UpdateExpression: 'SET #role = :role, municipalityId = :mid, updatedAt = :now',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: {
          ':role': role,
          ':mid': role === "municipality" ? municipalityId : null,
          ':now': new Date().toISOString(),
        },
      }));

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
      const client = getDocClient();
      const { id } = req.params;
      const { description, status, type, location, imageUrls } = req.body;

      const getResult = await client.send(new GetCommand({
        TableName: TABLES.ISSUES,
        Key: { issueId: id },
      }));

      if (!getResult.Item) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Issue not found",
          timestamp: new Date().toISOString(),
        });
      }

      const issueData = getResult.Item;
      const previousStatus = issueData.status;
      const municipalityId = issueData.municipalityId;

      const expressionParts: string[] = [];
      const expressionValues: Record<string, unknown> = {};
      const expressionNames: Record<string, string> = {};

      if (description !== undefined) {
        expressionParts.push('#description = :description');
        expressionNames['#description'] = 'description';
        expressionValues[':description'] = description;
      }
      if (type !== undefined) {
        expressionParts.push('#type = :type');
        expressionNames['#type'] = 'type';
        expressionValues[':type'] = type;
        expressionParts.push('classifiedType = :classifiedType');
        expressionValues[':classifiedType'] = type;
      }
      if (location !== undefined) {
        expressionParts.push('#location = :location');
        expressionNames['#location'] = 'location';
        expressionValues[':location'] = {
          ...issueData.location,
          ...location,
        };
      }
      if (imageUrls !== undefined && Array.isArray(imageUrls)) {
        expressionParts.push('imageUrls = :imageUrls');
        expressionValues[':imageUrls'] = imageUrls;
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
        expressionParts.push('#status = :status');
        expressionNames['#status'] = 'status';
        expressionValues[':status'] = status;
      }

      expressionParts.push('updatedAt = :updatedAt');
      expressionValues[':updatedAt'] = new Date().toISOString();

      await client.send(new UpdateCommand({
        TableName: TABLES.ISSUES,
        Key: { issueId: id },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeValues: expressionValues,
        ...(Object.keys(expressionNames).length > 0
          ? { ExpressionAttributeNames: expressionNames }
          : {}),
      }));

      // Update municipality resolved count if status changed
      if (status && status !== previousStatus && municipalityId) {
        const muniResult = await client.send(new GetCommand({
          TableName: TABLES.MUNICIPALITIES,
          Key: { municipalityId },
        }));

        if (muniResult.Item) {
          const muniData = muniResult.Item;
          let resolvedChange = 0;

          if (status === "CLOSED" && previousStatus !== "CLOSED") {
            resolvedChange = 1;
          } else if (status !== "CLOSED" && previousStatus === "CLOSED") {
            resolvedChange = -1;
          }

          if (resolvedChange !== 0) {
            const newResolved = Math.max(0, ((muniData.resolvedIssues as number) || 0) + resolvedChange);
            await client.send(new UpdateCommand({
              TableName: TABLES.MUNICIPALITIES,
              Key: { municipalityId },
              UpdateExpression: 'SET resolvedIssues = :resolved, updatedAt = :now',
              ExpressionAttributeValues: {
                ':resolved': newResolved,
                ':now': new Date().toISOString(),
              },
            }));
          }
        }
      }

      res.json({
        success: true,
        data: { id, description, status, type, location, imageUrls },
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
      const client = getDocClient();
      const { id } = req.params;

      const getResult = await client.send(new GetCommand({
        TableName: TABLES.ISSUES,
        Key: { issueId: id },
      }));

      if (!getResult.Item) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "Issue not found",
          timestamp: new Date().toISOString(),
        });
      }

      const issueData = getResult.Item;
      const municipalityId = issueData.municipalityId as string;

      await client.send(new DeleteCommand({
        TableName: TABLES.ISSUES,
        Key: { issueId: id },
      }));

      // Update municipality counts
      if (municipalityId) {
        const muniResult = await client.send(new GetCommand({
          TableName: TABLES.MUNICIPALITIES,
          Key: { municipalityId },
        }));

        if (muniResult.Item) {
          const muniData = muniResult.Item;
          const wasResolved = issueData.status === "CLOSED";
          const newTotal = Math.max(0, ((muniData.totalIssues as number) || 1) - 1);
          const newResolved = wasResolved
            ? Math.max(0, ((muniData.resolvedIssues as number) || 1) - 1)
            : (muniData.resolvedIssues as number) || 0;

          await client.send(new UpdateCommand({
            TableName: TABLES.MUNICIPALITIES,
            Key: { municipalityId },
            UpdateExpression: 'SET totalIssues = :total, resolvedIssues = :resolved, updatedAt = :now',
            ExpressionAttributeValues: {
              ':total': newTotal,
              ':resolved': newResolved,
              ':now': new Date().toISOString(),
            },
          }));
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
    const client = getDocClient();

    // Get counts in parallel using ScanCommand with Select: 'COUNT'
    const [usersCount, municipalitiesCount, issuesCount, pendingRegistrations] =
      await Promise.all([
        client.send(new ScanCommand({
          TableName: TABLES.USERS,
          Select: 'COUNT',
        })),
        client.send(new ScanCommand({
          TableName: TABLES.MUNICIPALITIES,
          Select: 'COUNT',
        })),
        client.send(new ScanCommand({
          TableName: TABLES.ISSUES,
          Select: 'COUNT',
        })),
        client.send(new QueryCommand({
          TableName: TABLES.MUNICIPALITY_REGISTRATIONS,
          IndexName: GSI.REGISTRATIONS_BY_STATUS,
          KeyConditionExpression: '#status = :status',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':status': 'PENDING' },
          Select: 'COUNT',
        })),
      ]);

    // Get all issues for detailed analytics
    const issuesScan = await client.send(new ScanCommand({
      TableName: TABLES.ISSUES,
    }));

    const allIssues = issuesScan.Items || [];

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

    allIssues.forEach((data) => {
      const status = data.status as string;
      const type = data.type as string;
      const municipalityId = data.municipalityId as string;
      const createdAt = new Date(data.createdAt as string);
      const closedAt = data.resolvedAt ? new Date(data.resolvedAt as string) : null;

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
      const muniPromises = topMunicipalityIds.map((id) =>
        client.send(new GetCommand({
          TableName: TABLES.MUNICIPALITIES,
          Key: { municipalityId: id },
        }))
      );
      const muniResults = await Promise.all(muniPromises);
      muniResults.forEach((result) => {
        if (result.Item && issuesByMunicipality[result.Item.municipalityId as string]) {
          issuesByMunicipality[result.Item.municipalityId as string].name =
            (result.Item.name as string) || "Unknown";
        }
      });
    }

    // Calculate average resolution time (in hours)
    const avgResolutionTimeHours = resolvedCount > 0
      ? Math.round(totalResolutionTime / resolvedCount / (1000 * 60 * 60))
      : 0;

    // Resolution rate
    const totalIssues = allIssues.length;
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
      const mlResponse = await fetch(
        `${process.env.ML_SERVICE_URL || "http://localhost:8000"}/health`,
        { signal: AbortSignal.timeout(2000) }
      );
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
        totalUsers: usersCount.Count || 0,
        totalMunicipalities: municipalitiesCount.Count || 0,
        totalIssues: issuesCount.Count || 0,
        pendingRegistrations: pendingRegistrations.Count || 0,
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
