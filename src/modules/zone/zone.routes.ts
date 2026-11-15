import { Router } from 'express';
import { ZoneController } from './zone.controller.js';
import { authenticateUser, authorizeRoles } from '../../middlewares/auth.js';
import { Role } from '../../generated/prisma/client.js';

const zoneRouter = Router();

// Read operations: Open to authenticated customers, operators, admins (and public discovery)
zoneRouter.get('/', ZoneController.listZones);
zoneRouter.get('/:id', ZoneController.getZoneById);

// Write operations: Strictly ADMIN only
zoneRouter.post('/', authenticateUser, authorizeRoles(Role.ADMIN), ZoneController.createZone);
zoneRouter.patch('/:id', authenticateUser, authorizeRoles(Role.ADMIN), ZoneController.updateZone);
zoneRouter.delete('/:id', authenticateUser, authorizeRoles(Role.ADMIN), ZoneController.deleteZone);

export default zoneRouter;
