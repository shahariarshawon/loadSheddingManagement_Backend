import { Router } from 'express';
import { OutageController } from './outage.controller.js';
import {
  authenticateUser,
  authorizeRoles,
  optionalAuthenticate,
} from '../../middlewares/auth.js';
import { Role } from '../../generated/prisma/client.js';

const outageRouter = Router();

// Read operations: Customers, Operators, Admins, and Public (drafts hidden for customers)
outageRouter.get('/', optionalAuthenticate, OutageController.listOutages);
outageRouter.get('/:id', optionalAuthenticate, OutageController.getOutageById);
outageRouter.get('/:id/history', optionalAuthenticate, OutageController.getOutageHistory);

// Assignments list for an outage
outageRouter.get(
  '/:id/assignments',
  authenticateUser,
  authorizeRoles(Role.POWER_OPERATOR, Role.ADMIN),
  OutageController.listAssignments,
);

// Write operations: Strictly POWER_OPERATOR and ADMIN
outageRouter.post(
  '/',
  authenticateUser,
  authorizeRoles(Role.POWER_OPERATOR, Role.ADMIN),
  OutageController.createOutage,
);

outageRouter.patch(
  '/:id',
  authenticateUser,
  authorizeRoles(Role.POWER_OPERATOR, Role.ADMIN),
  OutageController.updateOutage,
);

outageRouter.patch(
  '/:id/cancel',
  authenticateUser,
  authorizeRoles(Role.POWER_OPERATOR, Role.ADMIN),
  OutageController.cancelOutage,
);

outageRouter.delete(
  '/:id',
  authenticateUser,
  authorizeRoles(Role.POWER_OPERATOR, Role.ADMIN),
  OutageController.deleteOutage,
);

// Workflow operations: Technician assignment, repair progress updates, and restoration
outageRouter.post(
  '/:id/assign',
  authenticateUser,
  authorizeRoles(Role.POWER_OPERATOR, Role.ADMIN),
  OutageController.assignTechnician,
);

outageRouter.patch(
  '/:id/progress',
  authenticateUser,
  authorizeRoles(Role.POWER_OPERATOR, Role.ADMIN),
  OutageController.updateProgress,
);

outageRouter.post(
  '/:id/restore',
  authenticateUser,
  authorizeRoles(Role.POWER_OPERATOR, Role.ADMIN),
  OutageController.restoreOutage,
);

export default outageRouter;
