import { z } from 'zod';

export const createFeederSchema = z.object({
  name: z.string().trim().min(2, 'Feeder name must be at least 2 characters').max(100),
  code: z
    .string()
    .trim()
    .min(2, 'Feeder code must be at least 2 characters')
    .max(50)
    .toUpperCase(),
  substationId: z.string().trim().min(1, 'Valid Substation ID is required'),
  maxLoadKw: z.number().positive('Max load must be a positive number').optional(),
});

export const updateFeederSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  code: z.string().trim().min(2).max(50).toUpperCase().optional(),
  substationId: z.string().trim().min(1, 'Valid Substation ID is required').optional(),
  maxLoadKw: z.number().positive().optional(),
});

export type CreateFeederInput = z.infer<typeof createFeederSchema>;
export type UpdateFeederInput = z.infer<typeof updateFeederSchema>;
