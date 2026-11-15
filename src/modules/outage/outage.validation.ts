import { z } from 'zod';
import { OutageStatus, OutageType } from '../../generated/prisma/client.js';

export const createOutageSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
    description: z.string().trim().max(1000).optional(),
    areaId: z.string().trim().min(1, 'Valid Area ID is required'),
    startTime: z.string().datetime({ message: 'Invalid startTime format, must be ISO 8601' }),
    endTime: z.string().datetime({ message: 'Invalid endTime format, must be ISO 8601' }).optional(),
    estimatedEndTime: z.string().datetime({ message: 'Invalid estimatedEndTime format, must be ISO 8601' }).optional(),
    type: z.nativeEnum(OutageType).optional(),
    outageType: z.nativeEnum(OutageType).optional(),
    status: z.enum([OutageStatus.DRAFT, OutageStatus.PUBLISHED]).default(OutageStatus.PUBLISHED),
  })
  .refine((data) => data.endTime || data.estimatedEndTime, {
    message: 'Schedule endTime or estimatedEndTime is required',
    path: ['endTime'],
  })
  .transform((data) => ({
    title: data.title,
    description: data.description,
    areaId: data.areaId,
    startTime: data.startTime,
    endTime: (data.endTime || data.estimatedEndTime)!,
    type: data.type || data.outageType || OutageType.PLANNED,
    status: data.status,
  }))
  .refine((data) => new Date(data.startTime) < new Date(data.endTime), {
    message: 'Schedule endTime must be strictly after startTime',
    path: ['endTime'],
  });

export const updateOutageSchema = z
  .object({
    title: z.string().trim().min(3).max(150).optional(),
    description: z.string().trim().max(1000).optional(),
    areaId: z.string().trim().min(1).optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    estimatedEndTime: z.string().datetime().optional(),
    type: z.nativeEnum(OutageType).optional(),
    outageType: z.nativeEnum(OutageType).optional(),
    status: z.nativeEnum(OutageStatus).optional(),
  })
  .transform((data) => ({
    title: data.title,
    description: data.description,
    areaId: data.areaId,
    startTime: data.startTime,
    endTime: data.endTime || data.estimatedEndTime,
    type: data.type || data.outageType,
    status: data.status,
  }))
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

export const assignTechnicianSchema = z.object({
  technicianId: z.string({ message: 'Technician ID is required' }).trim().min(1, 'Technician ID is required'),
  notes: z.string().trim().max(1000).optional(),
});

export const updateProgressSchema = z
  .object({
    repairNotes: z.string().trim().min(3, 'Notes must be at least 3 characters').optional(),
    notes: z.string().trim().min(3, 'Notes must be at least 3 characters').optional(),
    status: z.nativeEnum(OutageStatus).optional(),
  })
  .refine((data) => data.repairNotes || data.notes, {
    message: 'Repair notes are required',
    path: ['repairNotes'],
  })
  .transform((data) => ({
    repairNotes: (data.repairNotes || data.notes)!,
    status: data.status,
  }));

export const restoreOutageSchema = z
  .object({
    notes: z.string().trim().max(1000).optional(),
    restorationNotes: z.string().trim().max(1000).optional(),
    actualRestoreTime: z.string().datetime({ message: 'Invalid actualRestoreTime ISO format' }).optional(),
  })
  .transform((data) => ({
    notes: data.notes || data.restorationNotes,
    actualRestoreTime: data.actualRestoreTime,
  }));

export type CreateOutageInput = z.infer<typeof createOutageSchema>;
export type UpdateOutageInput = z.infer<typeof updateOutageSchema>;
export type CancelOutageInput = z.infer<typeof cancelOutageSchema>;
export type AssignTechnicianInput = z.infer<typeof assignTechnicianSchema>;
export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;
export type RestoreOutageInput = z.infer<typeof restoreOutageSchema>;
