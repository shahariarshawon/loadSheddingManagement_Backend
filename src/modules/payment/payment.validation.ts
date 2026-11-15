import { z } from 'zod';
import { SubscriptionPlan, PaymentStatus } from '../../generated/prisma/client.js';

export const createCheckoutSchema = z.object({
  plan: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val === 'PREMIUM_MONTHLY' || val === 'MONTHLY') {
        return SubscriptionPlan.MONTHLY_PRIORITY;
      }
      if (val === 'ANNUAL' || val === 'PREMIUM_ANNUAL') {
        return SubscriptionPlan.ANNUAL_PRIORITY;
      }
      return val as SubscriptionPlan;
    })
    .pipe(z.nativeEnum(SubscriptionPlan))
    .default(SubscriptionPlan.MONTHLY_PRIORITY),
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
