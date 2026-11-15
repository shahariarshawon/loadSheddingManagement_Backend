import { Router } from 'express';
import { OutageReportController } from './outageReport.controller.js';
import { authenticateUser, authorizeRoles } from '../../middlewares/auth.js';
import { Role } from '../../generated/prisma/client.js';

const outageReportRouter = Router();

// Customer endpoints
outageReportRouter.post(
  '/',
  authenticateUser,
  OutageReportController.createReport,
);

outageReportRouter.get(
  '/my',
  authenticateUser,
  OutageReportController.getMyReports,
);

// Operator/Admin list of all outage reports
outageReportRouter.get(
  '/',
  authenticateUser,
  authorizeRoles(Role.POWER_OPERATOR, Role.ADMIN),
  OutageReportController.listReports,
);

// Individual report details (Customers view own; Operators/Admins view all)
outageReportRouter.get(
  '/:id',
  authenticateUser,
  OutageReportController.getReportById,
);

// Customer update own pending report
outageReportRouter.patch(
  '/:id',
  authenticateUser,
  OutageReportController.updateReport,
);

// Customer withdraw / Admin delete pending report
outageReportRouter.delete(
  '/:id',
  authenticateUser,
  OutageReportController.withdrawReport,
);

// Operator / Admin verification and rejection workflows
outageReportRouter.patch(
  '/:id/verify',
  authenticateUser,
  authorizeRoles(Role.POWER_OPERATOR, Role.ADMIN),
  OutageReportController.verifyReport,
);

outageReportRouter.patch(
  '/:id/reject',
  authenticateUser,
  authorizeRoles(Role.POWER_OPERATOR, Role.ADMIN),
  OutageReportController.rejectReport,
);

export default outageReportRouter;
