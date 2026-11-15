import { Router } from 'express';
import { PremiumController } from './premium.controller.js';
import { authenticateUser } from '../../middlewares/auth.js';

const premiumRouter = Router();

// Check user's current subscription status and remaining validity
premiumRouter.get('/status', authenticateUser, PremiumController.getSubscriptionStatus);

// Access protected premium feature: Area Reliability Analytics
premiumRouter.get(
  '/area-analytics',
  authenticateUser,
  PremiumController.getAreaReliabilityAnalytics,
);

export default premiumRouter;
