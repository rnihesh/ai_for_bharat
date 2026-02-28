import { Router } from 'express';
import type { Router as IRouter } from 'express';

const router: IRouter = Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    },
    error: null,
    timestamp: new Date().toISOString()
  });
});

export { router as healthRoutes };
