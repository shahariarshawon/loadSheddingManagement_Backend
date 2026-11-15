import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authRateLimiter } from '../../middlewares/rateLimiter.js';

const authRouter = Router();

authRouter.post('/register', authRateLimiter, AuthController.register);
authRouter.post('/login', authRateLimiter, AuthController.login);
authRouter.post('/google', authRateLimiter, AuthController.googleLogin);
authRouter.post('/refresh-token', authRateLimiter, AuthController.refreshToken);
authRouter.post('/logout', AuthController.logout);

export default authRouter;
