import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { sendSuccess } from '../utils/response.js';
import authRouter from '../modules/auth/auth.routes.js';
import userRouter from '../modules/user/user.routes.js';
import adminRouter from '../modules/admin/admin.routes.js';

const apiRouter = Router();

// Health Check Endpoint (verifies both API server and Neon database connection)
apiRouter.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Safe read-only connection check
    await prisma.$queryRaw`SELECT 1`;

    return sendSuccess(res, 200, {
      message: 'Server is running',
      data: {
        status: 'ok',
        database: 'connected',
        service: 'GridWatch API',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Phase 3 Modules
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/admin', adminRouter);

export default apiRouter;
