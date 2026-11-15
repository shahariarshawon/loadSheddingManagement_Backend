import { Router, Request, Response } from 'express';
import { sendSuccess } from '../utils/response.js';

const apiRouter = Router();

// Health Check Endpoint
apiRouter.get('/health', (_req: Request, res: Response) => {
  return sendSuccess(res, 200, {
    message: 'Server is running',
    data: {
      status: 'ok',
      service: 'GridWatch API',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

export default apiRouter;
