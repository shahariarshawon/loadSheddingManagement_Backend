import { Router } from 'express';
import { TechnicianController } from './technician.controller.js';
import { authenticateUser, authorizeRoles } from '../../middlewares/auth.js';
import { Role } from '../../generated/prisma/client.js';

const technicianRouter = Router();

// Operators & Admins can read technicians
technicianRouter.get(
  '/',
  authenticateUser,
  authorizeRoles(Role.POWER_OPERATOR, Role.ADMIN),
  TechnicianController.listTechnicians,
);

technicianRouter.get(
  '/:id',
  authenticateUser,
  authorizeRoles(Role.POWER_OPERATOR, Role.ADMIN),
  TechnicianController.getTechnicianById,
);

// Admin-only creation and deletion; Operators & Admins can update status/availability
technicianRouter.post(
  '/',
  authenticateUser,
  authorizeRoles(Role.ADMIN),
  TechnicianController.createTechnician,
);

technicianRouter.patch(
  '/:id',
  authenticateUser,
  authorizeRoles(Role.ADMIN, Role.POWER_OPERATOR),
  TechnicianController.updateTechnician,
);

technicianRouter.delete(
  '/:id',
  authenticateUser,
  authorizeRoles(Role.ADMIN),
  TechnicianController.deleteTechnician,
);

export default technicianRouter;
