import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { sendSuccess } from '../utils/response.js';

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

export default apiRouter;
