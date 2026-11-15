import { prisma } from '../../config/prisma.js';
import { stripe } from '../../config/stripe.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/appError.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { CreateCheckoutInput } from './payment.validation.js';
import {
  PaymentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  Role,
  Prisma,
} from '../../generated/prisma/client.js';
import Stripe from 'stripe';

export const PLAN_CONFIG: Record<
  SubscriptionPlan,
  {
    name: string;
    description: string;
    amountInCents: number;
    amountInDollars: number;
    durationDays: number;
  }
> = {
  [SubscriptionPlan.MONTHLY_PRIORITY]: {
    name: 'GridWatch 30-Day Premium Area Reliability Pass',
    description:
      '30-day full access to area reliability analytics, historical downtime metrics, and restoration performance trends.',
    amountInCents: 1000, // $10.00 USD
    amountInDollars: 10.0,
    durationDays: 30,
  },
  [SubscriptionPlan.ANNUAL_PRIORITY]: {
    name: 'GridWatch 365-Day Premium Annual Pass',
    description:
      '365-day annual pass for comprehensive grid analytics, outage frequency analysis, and priority reports.',
    amountInCents: 9900, // $99.00 USD
    amountInDollars: 99.0,
    durationDays: 365,
  },
};

export class PaymentService {
  /**
   * Initiate a Stripe Checkout session with server-controlled pricing
   */
  static async createCheckoutSession(
    userId: string,
    input: CreateCheckoutInput,
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw AppError.notFound(`User with ID '${userId}' not found.`);
    }

    if (!user.isActive) {
      throw AppError.forbidden('Your account is currently suspended.');
    }

    const plan = input.plan || SubscriptionPlan.MONTHLY_PRIORITY;
    const planDetails = PLAN_CONFIG[plan];

    if (!planDetails) {
      throw AppError.badRequest(`Invalid subscription plan: '${plan}'.`);
    }

    // Determine redirect URLs
    const successUrl =
      env.STRIPE_SUCCESS_URL ||
      `${env.CLIENT_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      env.STRIPE_CANCEL_URL || `${env.CLIENT_URL}/payments/cancel`;

    try {
      // Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: user.email,
        client_reference_id: user.id,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: planDetails.name,
                description: planDetails.description,
              },
              unit_amount: planDetails.amountInCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId: user.id,
          plan,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      // Save pending payment record in PostgreSQL
      const payment = await prisma.payment.create({
        data: {
          userId: user.id,
          stripeSessionId: session.id,
          amount: new Prisma.Decimal(planDetails.amountInDollars),
          currency: 'USD',
          status: PaymentStatus.PENDING,
          metadata: {
            plan,
            planName: planDetails.name,
            checkoutUrl: session.url,
          },
        },
      });

      return {
        paymentId: payment.id,
        checkoutUrl: session.url,
        url: session.url,
        sessionId: session.id,
        amount: planDetails.amountInDollars,
        currency: 'USD',
        plan,
      };
    } catch (error: unknown) {
      const err = error as Error;
      throw AppError.badRequest(`Stripe Checkout Session creation failed: ${err.message}`);
    }
  }

  /**
   * Handle incoming Stripe webhook events with signature verification and idempotency
   */
  static async handleWebhookEvent(
    rawBody: Buffer | string,
    signature: string,
  ) {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw AppError.internal('STRIPE_WEBHOOK_SECRET is not configured on the server.');
    }

    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err: unknown) {
      const error = err as Error;
      throw AppError.badRequest(`Webhook Signature Verification Failed: ${error.message}`);
    }

    // Idempotency Guard: Prevent duplicate event processing
    const existingProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { id: event.id },
    });

    if (existingProcessed) {
      return {
        received: true,
        duplicate: true,
        eventId: event.id,
        message: 'Event already processed',
      };
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Verify session was actually paid
        if (session.payment_status === 'paid') {
          await prisma.$transaction(async (tx) => {
            // 1. Mark event as processed (prevents race condition replays)
            await tx.processedWebhookEvent.create({
              data: {
                id: event.id,
                type: event.type,
              },
            });

            // 2. Find internal payment record
            const payment = await tx.payment.findUnique({
              where: { stripeSessionId: session.id },
            });

            if (!payment) {
              return;
            }

            // Guard: If already marked SUCCEEDED, do not re-extend
            if (payment.status === PaymentStatus.SUCCEEDED) {
              return;
            }

            const plan =
              ((payment.metadata as Record<string, unknown>)?.plan as SubscriptionPlan) ||
              SubscriptionPlan.MONTHLY_PRIORITY;
            const durationDays = PLAN_CONFIG[plan]?.durationDays || 30;

            // 3. Check for existing active subscription
            const existingActiveSub = await tx.subscription.findFirst({
              where: {
                userId: payment.userId,
                status: SubscriptionStatus.ACTIVE,
                endDate: { gt: new Date() },
              },
              orderBy: { endDate: 'desc' },
            });

            let finalSubscriptionId: string;

            if (existingActiveSub) {
              // Extend existing subscription
              const newEndDate = new Date(
                existingActiveSub.endDate.getTime() + durationDays * 24 * 60 * 60 * 1000,
              );

              const updatedSub = await tx.subscription.update({
                where: { id: existingActiveSub.id },
                data: {
                  endDate: newEndDate,
                  plan,
                },
              });

              finalSubscriptionId = updatedSub.id;
            } else {
              // Create brand new subscription
              const startDate = new Date();
              const endDate = new Date(
                startDate.getTime() + durationDays * 24 * 60 * 60 * 1000,
              );

              const newSub = await tx.subscription.create({
                data: {
                  userId: payment.userId,
                  plan,
                  status: SubscriptionStatus.ACTIVE,
                  startDate,
                  endDate,
                },
              });

              finalSubscriptionId = newSub.id;
            }

            // 4. Update Payment to SUCCEEDED and link subscription
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: PaymentStatus.SUCCEEDED,
                stripePaymentIntentId:
                  typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : null,
                subscriptionId: finalSubscriptionId,
                paidAt: new Date(),
              },
            });

            // 5. In-App Notification
            await tx.notification.create({
              data: {
                userId: payment.userId,
                title: 'Premium Pass Activated!',
                message: `Thank you! Your payment of $${payment.amount} was confirmed. Your ${PLAN_CONFIG[plan].name} has been activated.`,
                type: 'SUBSCRIPTION_ACTIVATED',
                metadata: {
                  paymentId: payment.id,
                  subscriptionId: finalSubscriptionId,
                  plan,
                },
              },
            });

            // 6. Audit Log
            await tx.auditLog.create({
              data: {
                userId: payment.userId,
                action: 'PREMIUM_SUBSCRIPTION_ACTIVATED',
                entity: 'Payment',
                entityId: payment.id,
                details: {
                  stripeSessionId: session.id,
                  plan,
                  amount: Number(payment.amount),
                  subscriptionId: finalSubscriptionId,
                },
              },
            });
          });
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;

        await prisma.$transaction(async (tx) => {
          await tx.processedWebhookEvent.create({
            data: { id: event.id, type: event.type },
          });

          const payment = await tx.payment.findUnique({
            where: { stripeSessionId: session.id },
          });

          if (payment && payment.status === PaymentStatus.PENDING) {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: PaymentStatus.CANCELLED },
            });
          }
        });
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;

        await prisma.$transaction(async (tx) => {
          await tx.processedWebhookEvent.create({
            data: { id: event.id, type: event.type },
          });

          const payment = await tx.payment.findUnique({
            where: { stripeSessionId: session.id },
          });

          if (payment && payment.status === PaymentStatus.PENDING) {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: PaymentStatus.FAILED },
            });
          }
        });
        break;
      }

      default:
        // Ignore unhandled event types cleanly
        break;
    }

    return { received: true, eventId: event.id };
  }

  /**
   * Get payments for authenticated customer
   */
  static async getMyPayments(userId: string, query: Record<string, unknown>) {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(
      query,
      ['createdAt', 'amount', 'status'],
      'createdAt',
      'desc',
    );

    const status =
      typeof query.status === 'string' && query.status in PaymentStatus
        ? (query.status as PaymentStatus)
        : undefined;

    const where: Prisma.PaymentWhereInput = {
      userId,
      ...(status && { status }),
    };

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          subscription: {
            select: {
              id: true,
              plan: true,
              status: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      }),
    ]);

    return {
      payments,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * Get single payment by ID (Customer owner or Admin)
   */
  static async getPaymentById(
    paymentId: string,
    user: { id: string; role: Role },
  ) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        subscription: {
          select: {
            id: true,
            plan: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!payment) {
      throw AppError.notFound(`Payment with ID '${paymentId}' not found.`);
    }

    if (user.role === Role.CUSTOMER && payment.userId !== user.id) {
      throw AppError.forbidden('You are not authorized to view this payment.');
    }

    return payment;
  }

  /**
   * Real-time payment status lookup by Stripe Session ID
   */
  static async getPaymentStatusBySession(sessionId: string, userId: string) {
    const payment = await prisma.payment.findUnique({
      where: { stripeSessionId: sessionId },
      include: {
        subscription: {
          select: {
            id: true,
            plan: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!payment) {
      throw AppError.notFound(`No payment found for session '${sessionId}'.`);
    }

    if (payment.userId !== userId) {
      throw AppError.forbidden('You are not authorized to view this payment.');
    }

    return payment;
  }

  /**
   * List all platform payments (Admin only)
   */
  static async listAllPayments(query: Record<string, unknown>) {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(
      query,
      ['createdAt', 'amount', 'status'],
      'createdAt',
      'desc',
    );

    const status =
      typeof query.status === 'string' && query.status in PaymentStatus
        ? (query.status as PaymentStatus)
        : undefined;
    const search = typeof query.search === 'string' ? query.search.trim() : undefined;

    const where: Prisma.PaymentWhereInput = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { stripeSessionId: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: { select: { id: true, name: true, email: true } },
          subscription: {
            select: {
              id: true,
              plan: true,
              status: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      }),
    ]);

    return {
      payments,
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}
