import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  areaId: z.string().uuid('Invalid area ID format').optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
