import { Router, Request, Response } from 'express';
import type { Router as IRouter } from 'express';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient, TABLES } from '../shared/aws';
import { loginInputSchema } from '../shared/validation';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router: IRouter = Router();

// Get current user profile (authenticated)
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await getDocClient().send(new GetCommand({
      TableName: TABLES.USERS,
      Key: { uid: req.user!.uid },
    }));

    if (!result.Item) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const user = {
      id: result.Item.uid,
      ...result.Item,
    };

    res.json({
      success: true,
      data: user,
      error: null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to fetch user profile',
      timestamp: new Date().toISOString()
    });
  }
});

// Verify token (for client-side auth check)
router.post('/verify', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      uid: req.user?.uid,
      email: req.user?.email,
      role: req.user?.role,
      municipalityId: req.user?.municipalityId
    },
    error: null,
    timestamp: new Date().toISOString()
  });
});

// Update last login (called after successful auth)
router.post('/login', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date().toISOString();

    await getDocClient().send(new UpdateCommand({
      TableName: TABLES.USERS,
      Key: { uid: req.user!.uid },
      UpdateExpression: 'SET lastLoginAt = :now',
      ExpressionAttributeValues: { ':now': now },
    }));

    res.json({
      success: true,
      data: { lastLoginAt: now },
      error: null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating last login:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to update last login',
      timestamp: new Date().toISOString()
    });
  }
});

export { router as authRoutes };
