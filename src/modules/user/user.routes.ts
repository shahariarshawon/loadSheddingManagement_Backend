import { Router } from 'express';
import { UserController } from './user.controller.js';
import { authenticateUser } from '../../middlewares/auth.js';

const userRouter = Router();

// User profile endpoints (accessible by all authenticated roles: CUSTOMER, POWER_OPERATOR, ADMIN)
userRouter.get('/me', authenticateUser, UserController.getMyProfile);
userRouter.patch('/me', authenticateUser, UserController.updateMyProfile);

export default userRouter;
