import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/appError.js';
import { CreateOutageInput, UpdateOutageInput } from './outage.validation.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { OutageStatus, OutageType, Role, Prisma } from '../../generated/prisma/client.js';

export class OutageService {
  /**
   * Check for overlapping outage schedules in the same area
   */
  static async checkScheduleConflict(
    areaId: string,
    start: Date,
    end: Date,
    excludeOutageId?: string,
  ) {
    const conflicting = await prisma.outage.findFirst({
      where: {
        areaId,
        deletedAt: null,
        status: {
          notIn: [OutageStatus.CANCELLED, OutageStatus.COMPLETED],
        },
        ...(excludeOutageId && { id: { not: excludeOutageId } }),
        AND: [
          { startTime: { lt: end } },
          {
            OR: [
              { endTime: null },
              { endTime: { gt: start } },
            ],
          },
        ],
      },
      include: {
        area: { select: { name: true } },
      },
    });

    if (conflicting) {
      const endStr = conflicting.endTime ? conflicting.endTime.toISOString() : 'indefinite';
      throw AppError.conflict(
        `Scheduling Conflict: An overlapping outage ('${conflicting.title}', #${conflicting.outageNumber}) is already scheduled for area '${conflicting.area.name}' between ${conflicting.startTime.toISOString()} and ${endStr}.`,
      );
    }
  }

  /**
   * Create a planned load-shedding schedule with conflict validation
   */
  static async createOutage(
    userId: string,
    input: CreateOutageInput,
    ipAddress?: string,
  ) {
    const area = await prisma.area.findFirst({
      where: { id: input.areaId, deletedAt: null },
      include: { feeder: true },
    });
    if (!area) {
      throw AppError.badRequest(`Target Area with ID '${input.areaId}' does not exist.`);
    }

    const startDateTime = new Date(input.startTime);
    const endDateTime = new Date(input.endTime);

    // Validate schedule conflicts
    await this.checkScheduleConflict(input.areaId, startDateTime, endDateTime);

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const outageNumber = `OUT-PLN-${datePrefix}-${randomSuffix}`;

    const [outage] = await prisma.$transaction([
      prisma.outage.create({
        data: {
          outageNumber,
          title: input.title,
          description: input.description || null,
          areaId: input.areaId,
          startTime: startDateTime,
          endTime: endDateTime,
          type: input.type || OutageType.PLANNED,
          status: input.status || OutageStatus.PUBLISHED,
          createdById: userId,
        },
        include: {
          area: {
            select: {
              id: true,
              name: true,
              postalCode: true,
              feeder: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  substation: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                      zone: { select: { id: true, name: true, code: true } },
                    },
                  },
                },
              },
            },
          },
          createdBy: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'OUTAGE_SCHEDULE_CREATED',
          entity: 'Outage',
          details: {
            outageNumber,
            title: input.title,
            areaId: input.areaId,
            startTime: input.startTime,
            endTime: input.endTime,
          },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return outage;
  }

  /**
   * List outages with advanced filtering, sorting, pagination, and RBAC visibility
   */
  static async listOutages(query: Record<string, unknown>, userRole?: Role) {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(
      query,
      ['startTime', 'endTime', 'createdAt', 'title'],
      'startTime',
      'asc',
    );

    const type = typeof query.type === 'string' && query.type in OutageType ? (query.type as OutageType) : undefined;
    const status = typeof query.status === 'string' && query.status in OutageStatus ? (query.status as OutageStatus) : undefined;
    const areaId = typeof query.areaId === 'string' && query.areaId ? query.areaId : undefined;
    const feederId = typeof query.feederId === 'string' && query.feederId ? query.feederId : undefined;
    const zoneId = typeof query.zoneId === 'string' && query.zoneId ? query.zoneId : undefined;
    const search = typeof query.search === 'string' ? query.search.trim() : undefined;
    const startDate = typeof query.startDate === 'string' && !isNaN(Date.parse(query.startDate)) ? new Date(query.startDate) : undefined;
    const endDate = typeof query.endDate === 'string' && !isNaN(Date.parse(query.endDate)) ? new Date(query.endDate) : undefined;

    // RBAC: Customers and public cannot view internal DRAFT outages
    const isPrivileged = userRole === Role.ADMIN || userRole === Role.POWER_OPERATOR;

    const where: Prisma.OutageWhereInput = {
      deletedAt: null,
      ...(type && { type }),
      ...(status ? { status } : !isPrivileged ? { status: { not: OutageStatus.DRAFT } } : {}),
      ...(areaId && { areaId }),
      ...(feederId && { area: { feederId, deletedAt: null } }),
      ...(zoneId && { area: { feeder: { substation: { zoneId, deletedAt: null }, deletedAt: null }, deletedAt: null } }),
      ...(startDate && { startTime: { gte: startDate } }),
      ...(endDate && { endTime: { lte: endDate } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { outageNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, outages] = await Promise.all([
      prisma.outage.count({ where }),
      prisma.outage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          area: {
            select: {
              id: true,
              name: true,
              postalCode: true,
              feeder: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  substation: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                      zone: { select: { id: true, name: true, code: true } },
                    },
                  },
                },
              },
            },
          },
          createdBy: { select: { id: true, name: true, role: true } },
        },
      }),
    ]);

    return {
      outages,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * Get single outage details
   */
  static async getOutageById(id: string, userRole?: Role) {
    const outage = await prisma.outage.findFirst({
      where: { id, deletedAt: null },
      include: {
        area: {
          select: {
            id: true,
            name: true,
            postalCode: true,
            feeder: {
              select: {
                id: true,
                name: true,
                code: true,
                maxLoadKw: true,
                substation: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    capacityKva: true,
                    zone: { select: { id: true, name: true, code: true, description: true } },
                  },
                },
              },
            },
          },
        },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!outage) {
      throw AppError.notFound(`Outage with ID '${id}' not found.`);
    }

    const isPrivileged = userRole === Role.ADMIN || userRole === Role.POWER_OPERATOR;
    if (!isPrivileged && outage.status === OutageStatus.DRAFT) {
      throw AppError.notFound(`Outage with ID '${id}' not found.`);
    }

    return outage;
  }

  /**
   * Update an existing scheduled outage
   */
  static async updateOutage(
    userId: string,
    id: string,
    input: UpdateOutageInput,
    ipAddress?: string,
  ) {
    const existing = await prisma.outage.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw AppError.notFound(`Outage with ID '${id}' not found.`);
    }

    if (existing.status === OutageStatus.COMPLETED || existing.status === OutageStatus.CANCELLED) {
      throw AppError.badRequest(
        `Cannot modify an outage that has already been marked as ${existing.status}.`,
      );
    }

    const targetAreaId = input.areaId || existing.areaId;
    const startDateTime = input.startTime ? new Date(input.startTime) : existing.startTime;
    const endDateTime = input.endTime ? new Date(input.endTime) : existing.endTime;

    if (endDateTime && startDateTime >= endDateTime) {
      throw AppError.badRequest('Schedule endTime must be strictly after startTime.');
    }

    // Recheck schedule conflicts if area or timing changed
    if (input.areaId || input.startTime || input.endTime) {
      if (endDateTime) {
        await this.checkScheduleConflict(targetAreaId, startDateTime, endDateTime, id);
      }
    }

    const [updated] = await prisma.$transaction([
      prisma.outage.update({
        where: { id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.areaId !== undefined && { areaId: input.areaId }),
          ...(input.startTime !== undefined && { startTime: startDateTime }),
          ...(input.endTime !== undefined && { endTime: endDateTime }),
          ...(input.status !== undefined && { status: input.status }),
        },
        include: {
          area: {
            select: {
              id: true,
              name: true,
              postalCode: true,
            },
          },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'OUTAGE_SCHEDULE_UPDATED',
          entity: 'Outage',
          entityId: id,
          details: { previous: { title: existing.title, status: existing.status }, updated: input },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return updated;
  }

  /**
   * Cancel an outage schedule
   */
  static async cancelOutage(
    userId: string,
    id: string,
    reason: string,
    ipAddress?: string,
  ) {
    const existing = await prisma.outage.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw AppError.notFound(`Outage with ID '${id}' not found.`);
    }

    if (existing.status === OutageStatus.CANCELLED) {
      throw AppError.badRequest('This outage schedule has already been cancelled.');
    }

    if (existing.status === OutageStatus.COMPLETED) {
      throw AppError.badRequest('Cannot cancel an outage schedule that has already been completed.');
    }

    const [cancelled] = await prisma.$transaction([
      prisma.outage.update({
        where: { id },
        data: {
          status: OutageStatus.CANCELLED,
          cancellationReason: reason,
        },
        include: {
          area: { select: { id: true, name: true } },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'OUTAGE_SCHEDULE_CANCELLED',
          entity: 'Outage',
          entityId: id,
          details: { outageNumber: existing.outageNumber, reason },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return cancelled;
  }

  /**
   * Soft-delete an outage schedule
   */
  static async deleteOutage(userId: string, id: string, ipAddress?: string) {
    const existing = await prisma.outage.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw AppError.notFound(`Outage with ID '${id}' not found.`);
    }

    if (existing.status === OutageStatus.ACTIVE || existing.status === OutageStatus.IN_PROGRESS) {
      throw AppError.badRequest(
        'Cannot delete an active or in-progress outage. Please complete or cancel it first.',
      );
    }

    const [deleted] = await prisma.$transaction([
      prisma.outage.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'OUTAGE_SCHEDULE_DELETED',
          entity: 'Outage',
          entityId: id,
          details: { outageNumber: existing.outageNumber, title: existing.title },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return deleted;
  }
}
