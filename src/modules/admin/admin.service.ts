import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/appError.js';
import { Role, Prisma } from '../../generated/prisma/client.js';
import { ListUsersQuery, UpdateRoleInput, UpdateStatusInput } from './admin.validation.js';

export class AdminService {
  /**
   * List paginated users with role, status, and search filters
   */
  static async listUsers(query: ListUsersQuery) {
    const { page, limit, role, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          areaId: true,
          googleId: true,
          createdAt: true,
          updatedAt: true,
          area: {
            select: {
              id: true,
              name: true,
              postalCode: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      users,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Update user role with safety guard and audit log
   */
  static async updateUserRole(
    adminId: string,
    targetUserId: string,
    input: UpdateRoleInput,
    ipAddress?: string,
  ) {
    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
    });

    if (!targetUser) {
      throw AppError.notFound('Target user not found.');
    }

    if (targetUser.role === input.role) {
      return targetUser;
    }

    // Protection against demoting the last active administrator
    if (targetUser.role === Role.ADMIN && input.role !== Role.ADMIN) {
      const activeAdminCount = await prisma.user.count({
        where: {
          role: Role.ADMIN,
          isActive: true,
          deletedAt: null,
        },
      });

      if (activeAdminCount <= 1) {
        throw AppError.badRequest('Security violation: Cannot demote the last active Administrator in the system.');
      }
    }

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: { role: input.role },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          areaId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'USER_ROLE_CHANGED',
          entity: 'User',
          entityId: targetUserId,
          details: {
            targetEmail: targetUser.email,
            previousRole: targetUser.role,
            newRole: input.role,
          },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return updatedUser;
  }

  /**
   * Activate or suspend user account with audit log
   */
  static async updateUserStatus(
    adminId: string,
    targetUserId: string,
    input: UpdateStatusInput,
    ipAddress?: string,
  ) {
    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
    });

    if (!targetUser) {
      throw AppError.notFound('Target user not found.');
    }

    // Prevent admin from deactivating themselves
    if (adminId === targetUserId && !input.isActive) {
      throw AppError.badRequest('Administrators cannot suspend their own account.');
    }

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: { isActive: input.isActive },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          areaId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'USER_STATUS_CHANGED',
          entity: 'User',
          entityId: targetUserId,
          details: {
            targetEmail: targetUser.email,
            previousStatus: targetUser.isActive,
            newStatus: input.isActive,
          },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return updatedUser;
  }
}
