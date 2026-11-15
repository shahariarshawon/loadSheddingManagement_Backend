import { z } from 'zod';
import { ReportSeverity } from '../../generated/prisma/client.js';

export const createOutageReportSchema = z.object({
  areaId: z.string({ message: 'Target Area ID is required' }).uuid({ message: 'Invalid Area UUID' }),
  title: z.string().min(3, { message: 'Title must be at least 3 characters' }).max(150).optional(),
  description: z.string().min(5, { message: 'Description must be at least 5 characters long' }),
  severity: z.nativeEnum(ReportSeverity).optional(),
});

export const updateOutageReportSchema = z.object({
  title: z.string().min(3).max(150).optional(),
  description: z.string().min(5).optional(),
  severity: z.nativeEnum(ReportSeverity).optional(),
});

export const verifyOutageReportSchema = z.object({
  outageId: z.string().uuid({ message: 'Invalid Outage UUID' }).optional(),
  title: z.string().min(3).max(150).optional(),
  description: z.string().optional(),
  estimatedRestoreTime: z.string().datetime({ message: 'Invalid ISO datetime for estimatedRestoreTime' }).optional(),
});

export const rejectOutageReportSchema = z.object({
  reason: z.string().min(5, { message: 'Rejection reason must be at least 5 characters long' }),
});

export type CreateOutageReportInput = z.infer<typeof createOutageReportSchema>;
export type UpdateOutageReportInput = z.infer<typeof updateOutageReportSchema>;
export type VerifyOutageReportInput = z.infer<typeof verifyOutageReportSchema>;
export type RejectOutageReportInput = z.infer<typeof rejectOutageReportSchema>;
