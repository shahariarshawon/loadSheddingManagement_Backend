import { z } from 'zod';

export const createTechnicianSchema = z.object({
  name: z.string({ message: 'Technician name is required' }).min(2, { message: 'Name must be at least 2 characters' }),
  phone: z.string({ message: 'Phone number is required' }).min(7, { message: 'Phone must be at least 7 characters' }),
  specialization: z.string().optional(),
  zoneId: z.string({ message: 'Zone ID is required' }).trim().min(1, 'Zone ID is required'),
  isAvailable: z.boolean().optional(),
});

export const updateTechnicianSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(7).optional(),
  specialization: z.string().optional(),
  zoneId: z.string().trim().min(1).optional(),
  isAvailable: z.boolean().optional(),
});

export type CreateTechnicianInput = z.infer<typeof createTechnicianSchema>;
export type UpdateTechnicianInput = z.infer<typeof updateTechnicianSchema>;
