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

export default outageRouter;
