import { Router } from 'express';
import { SubstationController } from './substation.controller.js';
import { authenticateUser, authorizeRoles } from '../../middlewares/auth.js';
import { Role } from '../../generated/prisma/client.js';

const substationRouter = Router();

substationRouter.get('/', SubstationController.listSubstations);
substationRouter.get('/:id', SubstationController.getSubstationById);

// Admin-only mutations
substationRouter.post('/', authenticateUser, authorizeRoles(Role.ADMIN), SubstationController.createSubstation);
substationRouter.patch('/:id', authenticateUser, authorizeRoles(Role.ADMIN), SubstationController.updateSubstation);
substationRouter.delete('/:id', authenticateUser, authorizeRoles(Role.ADMIN), SubstationController.deleteSubstation);

export default substationRouter;
