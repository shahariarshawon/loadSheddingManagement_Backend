import { z } from 'zod';

export const createZoneSchema = z.object({
  name: z.string().trim().min(2, 'Zone name must be at least 2 characters').max(100),
  code: z
    .string()
    .trim()
    .min(2, 'Zone code must be at least 2 characters')
    .max(50)
    .toUpperCase(),
  description: z.string().trim().max(500).optional(),
});

export const updateZoneSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  code: z.string().trim().min(2).max(50).toUpperCase().optional(),
  description: z.string().trim().max(500).optional(),
});

export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;
