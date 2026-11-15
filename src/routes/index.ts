import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { sendSuccess } from '../utils/response.js';
import authRouter from '../modules/auth/auth.routes.js';
import userRouter from '../modules/user/user.routes.js';
import adminRouter from '../modules/admin/admin.routes.js';
import zoneRouter from '../modules/zone/zone.routes.js';
import substationRouter from '../modules/substation/substation.routes.js';
import feederRouter from '../modules/feeder/feeder.routes.js';
import areaRouter from '../modules/area/area.routes.js';
import outageRouter from '../modules/outage/outage.routes.js';
import outageReportRouter from '../modules/outageReport/outageReport.routes.js';
import technicianRouter from '../modules/technician/technician.routes.js';
import notificationRouter from '../modules/notification/notification.routes.js';
import paymentRouter from '../modules/payment/payment.routes.js';
import premiumRouter from '../modules/premium/premium.routes.js';

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

// Phase 3 Modules: Authentication, User & Administration
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/admin', adminRouter);

// Phase 4 Modules: Power Distribution Network & Outage Schedules
apiRouter.use('/zones', zoneRouter);
apiRouter.use('/substations', substationRouter);
apiRouter.use('/feeders', feederRouter);
apiRouter.use('/areas', areaRouter);
apiRouter.use('/outages', outageRouter);

// Phase 5 Modules: Customer Outage Reports, Technician Management & Notifications
apiRouter.use('/outage-reports', outageReportRouter);
apiRouter.use('/technicians', technicianRouter);
apiRouter.use('/notifications', notificationRouter);

// Phase 6 Modules: Stripe Payments & Premium Feature Management
apiRouter.use('/payments', paymentRouter);
apiRouter.use('/premium', premiumRouter);

export default apiRouter;
