import { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service.js';
import { createCheckoutSchema } from './payment.validation.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/appError.js';

export class PaymentController {
  /**
   * Initiate Stripe Checkout session (Customer only)
   */
  static async createCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const validated = createCheckoutSchema.parse(req.body);
      const result = await PaymentService.createCheckoutSession(req.user.id, validated);

      return sendSuccess(res, 201, {
        message: 'Stripe Checkout session created successfully',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Stripe Webhook Handler (Public, verifies Stripe-Signature header with raw body)
   */
  static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        throw AppError.badRequest('Missing or invalid stripe-signature header.');
      }

      const rawBody = req.rawBody || req.body;
      if (!rawBody) {
        throw AppError.badRequest('Webhook request body is empty or unreadable.');
      }

      const result = await PaymentService.handleWebhookEvent(rawBody, signature);

      // Return fast 200 to Stripe
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get payments for authenticated customer
   */
  static async getMyPayments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const result = await PaymentService.getMyPayments(req.user.id, req.query);

      return sendSuccess(res, 200, {
        message: 'My payments retrieved successfully',
        data: result.payments,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get single payment by ID (Customer owner or Admin)
   */
  static async getPaymentById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const payment = await PaymentService.getPaymentById(id, {
        id: req.user.id,
        role: req.user.role,
      });

      return sendSuccess(res, 200, {
        message: 'Payment details retrieved successfully',
        data: payment,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get real-time payment status by Stripe Session ID
   */
  static async getPaymentStatusBySession(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const sessionId = Array.isArray(req.params.sessionId)
        ? req.params.sessionId[0]
        : req.params.sessionId;

      const payment = await PaymentService.getPaymentStatusBySession(
        sessionId,
        req.user.id,
      );

      return sendSuccess(res, 200, {
        message: 'Payment status retrieved successfully',
        data: payment,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * List all platform payments (Admin only)
   */
  static async listAllPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PaymentService.listAllPayments(req.query);

      return sendSuccess(res, 200, {
        message: 'All platform payments retrieved successfully',
        data: result.payments,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Informational success redirect handler
   */
  static async handleSuccessRedirect(req: Request, res: Response) {
    const sessionId = req.query.session_id as string | undefined;

    return sendSuccess(res, 200, {
      message:
        'Checkout session completed. Payment fulfillment is verified server-side via Stripe Webhooks.',
      data: {
        sessionId: sessionId || null,
        info: 'Your premium access is activated automatically once Stripe confirms the transaction.',
      },
    });
  }

  /**
   * Informational cancel redirect handler
   */
  static async handleCancelRedirect(_req: Request, res: Response) {
    return sendSuccess(res, 200, {
      message: 'Stripe checkout session was cancelled. No charges were incurred.',
      data: {},
    });
  }
}
