import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/appError.js';
import {
  Role,
  Prisma,
  PaymentStatus,
  SubscriptionStatus,
  OutageStatus,
  OutageType,
  ReportStatus,
} from '../../generated/prisma/client.js';
import {
  ListUsersQuery,
  UpdateRoleInput,
  UpdateStatusInput,
  ListAuditLogsQuery,
} from './admin.validation.js';

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

  /**
   * List platform audit logs with entity, action, date, and user filters
   */
  static async listAuditLogs(query: ListAuditLogsQuery) {
    const { page, limit, action, entity, userId, startDate, endDate, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      ...(action && { action: { contains: action, mode: 'insensitive' } }),
      ...(entity && { entity: { contains: entity, mode: 'insensitive' } }),
      ...(userId && { userId }),
      ...(startDate && { createdAt: { gte: new Date(startDate) } }),
      ...(endDate && { createdAt: { lte: new Date(endDate) } }),
      ...(search && {
        OR: [
          { action: { contains: search, mode: 'insensitive' } },
          { entity: { contains: search, mode: 'insensitive' } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, auditLogs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      auditLogs,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * System-wide statistics for administrative monitoring
   */
  static async getSystemStats() {
    const [
      totalUsers,
      customerCount,
      operatorCount,
      adminCount,
      activeUsers,
      totalZones,
      totalSubstations,
      totalFeeders,
      totalAreas,
      totalOutages,
      activeOutages,
      plannedOutages,
      unexpectedOutages,
      restoredOutages,
      totalReports,
      pendingReports,
      verifiedReports,
      totalTechnicians,
      availableTechnicians,
      totalPayments,
      succeededPayments,
      activeSubscriptions,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { role: Role.CUSTOMER, deletedAt: null } }),
      prisma.user.count({ where: { role: Role.POWER_OPERATOR, deletedAt: null } }),
      prisma.user.count({ where: { role: Role.ADMIN, deletedAt: null } }),
      prisma.user.count({ where: { isActive: true, deletedAt: null } }),
      prisma.zone.count({ where: { deletedAt: null } }),
      prisma.substation.count({ where: { deletedAt: null } }),
      prisma.feeder.count({ where: { deletedAt: null } }),
      prisma.area.count({ where: { deletedAt: null } }),
      prisma.outage.count({ where: { deletedAt: null } }),
      prisma.outage.count({
        where: {
          status: { in: [OutageStatus.ACTIVE, OutageStatus.IN_PROGRESS] },
          deletedAt: null,
        },
      }),
      prisma.outage.count({ where: { type: OutageType.PLANNED, deletedAt: null } }),
      prisma.outage.count({ where: { type: OutageType.UNEXPECTED, deletedAt: null } }),
      prisma.outage.count({
        where: {
          status: { in: [OutageStatus.RESTORED, OutageStatus.COMPLETED] },
          deletedAt: null,
        },
      }),
      prisma.outageReport.count(),
      prisma.outageReport.count({ where: { status: ReportStatus.PENDING } }),
      prisma.outageReport.count({ where: { status: ReportStatus.VERIFIED } }),
      prisma.technician.count({ where: { deletedAt: null } }),
      prisma.technician.count({ where: { isAvailable: true, deletedAt: null } }),
      prisma.payment.count(),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.SUCCEEDED },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          endDate: { gt: new Date() },
        },
      }),
    ]);

    const totalRevenue = Number(succeededPayments._sum.amount || 0);

    return {
      users: {
        total: totalUsers,
        customers: customerCount,
        operators: operatorCount,
        admins: adminCount,
        active: activeUsers,
      },
      network: {
        zones: totalZones,
        substations: totalSubstations,
        feeders: totalFeeders,
        areas: totalAreas,
      },
      outages: {
        total: totalOutages,
        active: activeOutages,
        planned: plannedOutages,
        unexpected: unexpectedOutages,
        restored: restoredOutages,
      },
      reports: {
        total: totalReports,
        pending: pendingReports,
        verified: verifiedReports,
      },
      technicians: {
        total: totalTechnicians,
        available: availableTechnicians,
        busy: totalTechnicians - availableTechnicians,
      },
      finance: {
        totalPayments,
        successfulPayments: succeededPayments._count.id,
        totalRevenueUsd: totalRevenue,
        activeSubscribers: activeSubscriptions,
      },
    };
  }
}
