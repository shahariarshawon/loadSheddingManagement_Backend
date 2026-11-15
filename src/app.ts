import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import apiRouter from './routes/index.js';
import { sendSuccess } from './utils/response.js';

const app: Application = express();

// Trust proxy for Render reverse proxy rate-limiting
app.set('trust proxy', 1);

// Security Headers
app.use(helmet());

// CORS Configuration
app.use(
  cors({
    origin: env.CLIENT_URL === '*' ? '*' : [env.CLIENT_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Rate Limiting
app.use('/api', apiRateLimiter);

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root Welcome Route
app.get('/', (_req: Request, res: Response) => {
  return sendSuccess(res, 200, {
    message: 'GridWatch API - Load Shedding & Power Outage Management System',
    data: {
      version: 'v1',
      documentation: '/api/v1/docs',
      health: '/api/v1/health',
    },
  });
});

// Versioned API Routes (/api/v1)
app.use('/api/v1', apiRouter);

// 404 Not Found Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

export default app;
