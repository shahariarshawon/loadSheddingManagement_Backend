import { z } from 'zod';
import { Role } from '../../generated/prisma/client.js';

export const listUsersQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 10)),
  role: z.nativeEnum(Role).optional(),
  search: z.string().trim().optional(),
  isActive: z.string().optional().transform((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return undefined;
  }),
});

export const updateRoleSchema = z.object({
  role: z.nativeEnum(Role, {
    message: 'Valid role is required (CUSTOMER, POWER_OPERATOR, ADMIN)',
  }),
});

export const updateStatusSchema = z.object({
  isActive: z.boolean({
    message: 'isActive boolean flag is required',
  }),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
