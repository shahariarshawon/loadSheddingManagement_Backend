import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import apiRouter from './routes/index.js';
import { sendSuccess } from './utils/response.js';
import { openApiSpec } from './docs/openapi.js';

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

// Rate Limiting (exempt webhooks & docs from strict rate limiting)
app.use('/api', (req, res, next) => {
  if (req.originalUrl.includes('/payments/webhook')) {
    return next();
  }
  return apiRateLimiter(req, res, next);
});

// Stripe Webhook Raw Body Middleware:
// Stripe webhook signature verification requires the original, unaltered raw request buffer.
app.use(
  '/api/v1/payments/webhook',
  express.raw({ type: 'application/json' }),
);

// Body Parsing for all JSON and form endpoints
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// OpenAPI JSON Specification Endpoint
app.get('/api-docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  return res.json(openApiSpec);
});

// Swagger UI Configuration
app.use('/api-docs', (_req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('Cross-Origin-Embedder-Policy');
  next();
});

const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  customSiteTitle: 'GridWatch API - Swagger Documentation',
  customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
  customJs: [
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js',
  ],
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
};

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, swaggerUiOptions),
);

// Redirect /api/v1/docs to /api-docs for backward compatibility
app.get('/api/v1/docs', (_req: Request, res: Response) => {
  return res.redirect('/api-docs');
});

// Root Welcome Route
app.get('/', (_req: Request, res: Response) => {
  return sendSuccess(res, 200, {
    message: 'GridWatch API - Load Shedding & Power Outage Management System',
    data: {
      version: 'v1',
      documentation: '/api-docs',
      openApiSpec: '/api-docs.json',
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
