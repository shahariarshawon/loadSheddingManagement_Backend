import { Router } from 'express';
import { FeederController } from './feeder.controller.js';
import { authenticateUser, authorizeRoles } from '../../middlewares/auth.js';
import { Role } from '../../generated/prisma/client.js';

const feederRouter = Router();

feederRouter.get('/', FeederController.listFeeders);
feederRouter.get('/:id', FeederController.getFeederById);

// Admin-only mutations
feederRouter.post('/', authenticateUser, authorizeRoles(Role.ADMIN), FeederController.createFeeder);
feederRouter.patch('/:id', authenticateUser, authorizeRoles(Role.ADMIN), FeederController.updateFeeder);
feederRouter.delete('/:id', authenticateUser, authorizeRoles(Role.ADMIN), FeederController.deleteFeeder);

export default feederRouter;
