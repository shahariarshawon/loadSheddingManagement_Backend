import { z } from 'zod';
import { SubscriptionPlan, PaymentStatus } from '../../generated/prisma/client.js';

export const createCheckoutSchema = z.object({
  plan: z.nativeEnum(SubscriptionPlan).default(SubscriptionPlan.MONTHLY_PRIORITY),
});

export const paymentFilterSchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type PaymentFilterInput = z.infer<typeof paymentFilterSchema>;
