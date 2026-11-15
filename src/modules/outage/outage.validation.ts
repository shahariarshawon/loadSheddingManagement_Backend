import { z } from 'zod';
import { OutageStatus, OutageType } from '../../generated/prisma/client.js';

export const createOutageSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
    description: z.string().trim().max(1000).optional(),
    areaId: z.string().uuid('Valid Area ID is required'),
    startTime: z.string().datetime({ message: 'Invalid startTime format, must be ISO 8601' }),
    endTime: z.string().datetime({ message: 'Invalid endTime format, must be ISO 8601' }),
    type: z.nativeEnum(OutageType).default(OutageType.PLANNED),
    status: z.enum([OutageStatus.DRAFT, OutageStatus.PUBLISHED]).default(OutageStatus.PUBLISHED),
  })
  .refine((data) => new Date(data.startTime) < new Date(data.endTime), {
    message: 'Schedule endTime must be strictly after startTime',
    path: ['endTime'],
  });

export const updateOutageSchema = z
  .object({
    title: z.string().trim().min(3).max(150).optional(),
    description: z.string().trim().max(1000).optional(),
    areaId: z.string().uuid().optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    status: z.nativeEnum(OutageStatus).optional(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return new Date(data.startTime) < new Date(data.endTime);
      }
      return true;
    },
    {
      message: 'Schedule endTime must be strictly after startTime',
      path: ['endTime'],
    },
  );

export const cancelOutageSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Cancellation reason must be at least 3 characters')
    .max(500),
});

export type CreateOutageInput = z.infer<typeof createOutageSchema>;
export type UpdateOutageInput = z.infer<typeof updateOutageSchema>;
export type CancelOutageInput = z.infer<typeof cancelOutageSchema>;
