import { Router } from 'express';
import { PaymentController } from './payment.controller.js';
import { authenticateUser, authorizeRoles } from '../../middlewares/auth.js';
import { Role } from '../../generated/prisma/client.js';

const paymentRouter = Router();

// Stripe Webhook Endpoint (Public - verified via stripe-signature header)
paymentRouter.post('/webhook', PaymentController.handleWebhook);

// Informational Redirect Endpoints for Stripe Checkout
paymentRouter.get('/success', PaymentController.handleSuccessRedirect);
paymentRouter.get('/cancel', PaymentController.handleCancelRedirect);

// Customer Checkout Creation
paymentRouter.post(
  '/checkout',
  authenticateUser,
  authorizeRoles(Role.CUSTOMER, Role.ADMIN),
  PaymentController.createCheckout,
);

// Customer Payment History
paymentRouter.get('/my', authenticateUser, PaymentController.getMyPayments);

// Status lookup by Stripe Session ID
paymentRouter.get(
  '/status/:sessionId',
  authenticateUser,
  PaymentController.getPaymentStatusBySession,
);

// Admin-only listing of all payments
paymentRouter.get(
  '/',
  authenticateUser,
  authorizeRoles(Role.ADMIN),
  PaymentController.listAllPayments,
);

// Single Payment Details (Customer owner or Admin)
paymentRouter.get('/:id', authenticateUser, PaymentController.getPaymentById);

export default paymentRouter;
