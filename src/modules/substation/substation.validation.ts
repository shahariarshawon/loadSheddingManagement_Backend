import { z } from 'zod';

export const createSubstationSchema = z.object({
  name: z.string().trim().min(2, 'Substation name must be at least 2 characters').max(100),
  code: z
    .string()
    .trim()
    .min(2, 'Substation code must be at least 2 characters')
    .max(50)
    .toUpperCase(),
  zoneId: z.string().uuid('Valid Zone ID is required'),
  capacityKva: z.number().positive('Capacity must be a positive number').optional(),
});

export const updateSubstationSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  code: z.string().trim().min(2).max(50).toUpperCase().optional(),
  zoneId: z.string().uuid('Valid Zone ID is required').optional(),
  capacityKva: z.number().positive().optional(),
});

export type CreateSubstationInput = z.infer<typeof createSubstationSchema>;
export type UpdateSubstationInput = z.infer<typeof updateSubstationSchema>;
