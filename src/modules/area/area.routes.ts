import { Router } from 'express';
import { AreaController } from './area.controller.js';
import { authenticateUser, authorizeRoles } from '../../middlewares/auth.js';
import { Role } from '../../generated/prisma/client.js';

const areaRouter = Router();

areaRouter.get('/', AreaController.listAreas);
areaRouter.get('/:id', AreaController.getAreaById);

// Admin-only mutations
areaRouter.post('/', authenticateUser, authorizeRoles(Role.ADMIN), AreaController.createArea);
areaRouter.patch('/:id', authenticateUser, authorizeRoles(Role.ADMIN), AreaController.updateArea);
areaRouter.delete('/:id', authenticateUser, authorizeRoles(Role.ADMIN), AreaController.deleteArea);

export default areaRouter;
