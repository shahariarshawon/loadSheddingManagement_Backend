import { z } from 'zod';

export const createAreaSchema = z.object({
  name: z.string().trim().min(2, 'Area name must be at least 2 characters').max(100),
  postalCode: z.string().trim().max(20).optional(),
  feederId: z.string().uuid('Valid Feeder ID is required'),
});

export const updateAreaSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  feederId: z.string().uuid('Valid Feeder ID is required').optional(),
});

export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
