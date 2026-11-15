import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/appError.js';
import {
  CreateOutageInput,
  UpdateOutageInput,
  AssignTechnicianInput,
  UpdateProgressInput,
  RestoreOutageInput,
} from './outage.validation.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import {
  OutageStatus,
  OutageType,
  AssignmentStatus,
  ReportStatus,
  Role,
  Prisma,
} from '../../generated/prisma/client.js';

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
   * Create a planned load-shedding schedule with concurrency-safe conflict validation
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

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const outageNumber = `OUT-PLN-${datePrefix}-${randomSuffix}`;

    const outage = await prisma.$transaction(async (tx) => {
      // Transaction-scoped advisory lock on target area to serialize concurrent schedule checks
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'outage_schedule_' + input.areaId}))`;

      // Check for overlapping outage schedules in this area inside the lock
      const conflicting = await tx.outage.findFirst({
        where: {
          areaId: input.areaId,
          deletedAt: null,
          status: {
            notIn: [OutageStatus.CANCELLED, OutageStatus.COMPLETED],
          },
          AND: [
            { startTime: { lt: endDateTime } },
            {
              OR: [
                { endTime: null },
                { endTime: { gt: startDateTime } },
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

      const created = await tx.outage.create({
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
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'OUTAGE_SCHEDULE_CREATED',
          entity: 'Outage',
          entityId: created.id,
          details: {
            outageNumber,
            title: input.title,
            areaId: input.areaId,
            startTime: input.startTime,
            endTime: input.endTime,
          },
          ipAddress: ipAddress || null,
        },
      });

      return created;
    });

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

  /**
   * Concurrency-safe technician assignment with single-active assignment guard
   */
  static async assignTechnician(
    userId: string,
    outageId: string,
    input: AssignTechnicianInput,
    ipAddress?: string,
  ) {
    const outage = await prisma.outage.findFirst({
      where: { id: outageId, deletedAt: null },
      include: { area: { select: { id: true, name: true } } },
    });

    if (!outage) {
      throw AppError.notFound(`Outage with ID '${outageId}' not found.`);
    }

    if (
      outage.status === OutageStatus.CANCELLED ||
      outage.status === OutageStatus.COMPLETED ||
      outage.status === OutageStatus.RESTORED
    ) {
      throw AppError.badRequest(
        `Cannot assign technicians to an outage in '${outage.status}' status.`,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Transaction-scoped advisory lock on technician to serialize concurrent assignments for this technician
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'technician_assignment_' + input.technicianId}))`;

      const technician = await tx.technician.findFirst({
        where: { id: input.technicianId, deletedAt: null },
      });

      if (!technician) {
        throw AppError.notFound(`Technician with ID '${input.technicianId}' not found.`);
      }

      if (!technician.isAvailable) {
        throw AppError.conflict(
          `Technician '${technician.name}' is currently unavailable or assigned to another active outage.`,
        );
      }

      // Double assignment guard: Verify no ongoing active assignment inside the transaction lock
      const activeAssignment = await tx.technicianAssignment.findFirst({
        where: {
          technicianId: input.technicianId,
          status: {
            in: [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS],
          },
        },
      });

      if (activeAssignment) {
        throw AppError.conflict(
          `Technician '${technician.name}' already has an active ongoing assignment.`,
        );
      }

      // Create assignment
      const assignment = await tx.technicianAssignment.create({
        data: {
          outageId,
          technicianId: input.technicianId,
          assignedById: userId,
          status: AssignmentStatus.ASSIGNED,
          repairNotes: input.notes || null,
          assignedAt: new Date(),
        },
        include: {
          technician: {
            select: {
              id: true,
              name: true,
              phone: true,
              specialization: true,
            },
          },
          assignedBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Mark technician as busy
      await tx.technician.update({
        where: { id: input.technicianId },
        data: { isAvailable: false },
      });

      // Update outage status to IN_PROGRESS if DRAFT, PUBLISHED, or ACTIVE
      if (
        outage.status === OutageStatus.DRAFT ||
        outage.status === OutageStatus.PUBLISHED ||
        outage.status === OutageStatus.ACTIVE
      ) {
        await tx.outage.update({
          where: { id: outageId },
          data: { status: OutageStatus.IN_PROGRESS },
        });
      }

      // Record Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'TECHNICIAN_ASSIGNED',
          entity: 'Outage',
          entityId: outageId,
          details: {
            outageNumber: outage.outageNumber,
            technicianId: technician.id,
            technicianName: technician.name,
            notes: input.notes || null,
          },
          ipAddress: ipAddress || null,
        },
      });

      // Notify customers who submitted verified reports linked to this outage
      const linkedReports = await tx.outageReport.findMany({
        where: { outageId },
        select: { customerId: true, reportNumber: true },
      });

      for (const report of linkedReports) {
        await tx.notification.create({
          data: {
            userId: report.customerId,
            title: 'Technician Dispatched',
            message: `Technician ${technician.name} has been dispatched to resolve outage #${outage.outageNumber} (Report #${report.reportNumber}).`,
            type: 'TECHNICIAN_ASSIGNED',
            metadata: {
              outageId,
              outageNumber: outage.outageNumber,
              technicianId: technician.id,
              technicianName: technician.name,
            },
          },
        });
      }

      return assignment;
    });

    return result;
  }

  /**
   * List all assignments for an outage
   */
  static async listAssignments(outageId: string) {
    const outage = await prisma.outage.findFirst({
      where: { id: outageId, deletedAt: null },
    });

    if (!outage) {
      throw AppError.notFound(`Outage with ID '${outageId}' not found.`);
    }

    const assignments = await prisma.technicianAssignment.findMany({
      where: { outageId },
      orderBy: { assignedAt: 'desc' },
      include: {
        technician: {
          select: {
            id: true,
            name: true,
            phone: true,
            specialization: true,
            isAvailable: true,
            zone: { select: { id: true, name: true, code: true } },
          },
        },
        assignedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return assignments;
  }

  /**
   * Update repair progress notes and status
   */
  static async updateProgress(
    userId: string,
    outageId: string,
    input: UpdateProgressInput,
    ipAddress?: string,
  ) {
    const outage = await prisma.outage.findFirst({
      where: { id: outageId, deletedAt: null },
    });

    if (!outage) {
      throw AppError.notFound(`Outage with ID '${outageId}' not found.`);
    }

    if (
      outage.status === OutageStatus.CANCELLED ||
      outage.status === OutageStatus.COMPLETED ||
      outage.status === OutageStatus.RESTORED
    ) {
      throw AppError.badRequest(
        `Cannot update repair progress for an outage in '${outage.status}' status.`,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Find latest active assignment
      const activeAssignment = await tx.technicianAssignment.findFirst({
        where: {
          outageId,
          status: {
            in: [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS],
          },
        },
        orderBy: { assignedAt: 'desc' },
      });

      let updatedAssignment = null;
      if (activeAssignment) {
        const timestampedNote = `[${new Date().toISOString()}] ${input.repairNotes}`;
        const updatedNotes = activeAssignment.repairNotes
          ? `${activeAssignment.repairNotes}\n${timestampedNote}`
          : timestampedNote;

        updatedAssignment = await tx.technicianAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            repairNotes: updatedNotes,
            status: AssignmentStatus.IN_PROGRESS,
          },
          include: {
            technician: { select: { id: true, name: true, phone: true } },
          },
        });
      }

      // Update outage status
      const updatedOutage = await tx.outage.update({
        where: { id: outageId },
        data: {
          status: input.status || OutageStatus.IN_PROGRESS,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'REPAIR_PROGRESS_UPDATED',
          entity: 'Outage',
          entityId: outageId,
          details: {
            outageNumber: outage.outageNumber,
            repairNotes: input.repairNotes,
            status: input.status || OutageStatus.IN_PROGRESS,
          },
          ipAddress: ipAddress || null,
        },
      });

      return {
        outage: updatedOutage,
        assignment: updatedAssignment,
      };
    });

    return result;
  }

  /**
   * Mark outage restored: transitions outage to RESTORED, frees technicians, resolves reports, and sends notifications
   */
  static async restoreOutage(
    userId: string,
    outageId: string,
    input: RestoreOutageInput,
    ipAddress?: string,
  ) {
    const outage = await prisma.outage.findFirst({
      where: { id: outageId, deletedAt: null },
      include: { area: { select: { id: true, name: true } } },
    });

    if (!outage) {
      throw AppError.notFound(`Outage with ID '${outageId}' not found.`);
    }

    if (
      outage.status === OutageStatus.RESTORED ||
      outage.status === OutageStatus.COMPLETED ||
      outage.status === OutageStatus.CANCELLED
    ) {
      throw AppError.badRequest(
        `Outage is already in '${outage.status}' status and cannot be restored again.`,
      );
    }

    const restoreTime = input.actualRestoreTime ? new Date(input.actualRestoreTime) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update outage to RESTORED
      const restoredOutage = await tx.outage.update({
        where: { id: outageId },
        data: {
          status: OutageStatus.RESTORED,
          endTime: restoreTime,
        },
        include: {
          area: { select: { id: true, name: true } },
        },
      });

      // 2. Find and update all active assignments, freeing their technicians
      const activeAssignments = await tx.technicianAssignment.findMany({
        where: {
          outageId,
          status: {
            in: [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS],
          },
        },
      });

      for (const assignment of activeAssignments) {
        await tx.technicianAssignment.update({
          where: { id: assignment.id },
          data: {
            status: AssignmentStatus.RESTORED,
            restoredAt: restoreTime,
            completedAt: restoreTime,
            ...(input.notes && {
              repairNotes: assignment.repairNotes
                ? `${assignment.repairNotes}\n[Restoration Note] ${input.notes}`
                : `[Restoration Note] ${input.notes}`,
            }),
          },
        });

        // Set technician available
        await tx.technician.update({
          where: { id: assignment.technicianId },
          data: { isAvailable: true },
        });
      }

      // 3. Resolve all linked reports
      const linkedReports = await tx.outageReport.findMany({
        where: {
          outageId,
          status: { not: ReportStatus.REJECTED },
        },
      });

      await tx.outageReport.updateMany({
        where: {
          outageId,
          status: { not: ReportStatus.REJECTED },
        },
        data: {
          status: ReportStatus.RESOLVED,
        },
      });

      // 4. Send In-App Notifications to customers with linked reports
      for (const report of linkedReports) {
        await tx.notification.create({
          data: {
            userId: report.customerId,
            title: 'Power Restored',
            message: `Power has been successfully restored for outage #${outage.outageNumber}. Your report #${report.reportNumber} has been resolved.`,
            type: 'OUTAGE_RESTORED',
            metadata: {
              outageId,
              outageNumber: outage.outageNumber,
              reportId: report.id,
              reportNumber: report.reportNumber,
            },
          },
        });
      }

      // 5. Send In-App Notifications to all registered users residing in the affected area
      const areaUsers = await tx.user.findMany({
        where: {
          areaId: outage.areaId,
          isActive: true,
          deletedAt: null,
          role: Role.CUSTOMER,
        },
        select: { id: true },
      });

      for (const user of areaUsers) {
        // Skip duplicate notification if user already received one for linked report
        if (linkedReports.some((r) => r.customerId === user.id)) {
          continue;
        }

        await tx.notification.create({
          data: {
            userId: user.id,
            title: 'Power Restored in Your Area',
            message: `Power supply has been restored in ${outage.area.name}. Outage #${outage.outageNumber} is now resolved.`,
            type: 'OUTAGE_RESTORED',
            metadata: {
              outageId,
              outageNumber: outage.outageNumber,
              areaName: outage.area.name,
            },
          },
        });
      }

      // 6. Record Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'OUTAGE_RESTORED',
          entity: 'Outage',
          entityId: outageId,
          details: {
            outageNumber: outage.outageNumber,
            restoredAt: restoreTime.toISOString(),
            freedTechnicians: activeAssignments.length,
            resolvedReports: linkedReports.length,
            notes: input.notes || null,
          },
          ipAddress: ipAddress || null,
        },
      });

      return {
        outage: restoredOutage,
        freedTechniciansCount: activeAssignments.length,
        resolvedReportsCount: linkedReports.length,
      };
    });

    return result;
  }

  /**
   * Get chronological history event timeline for an outage
   */
  static async getOutageHistory(outageId: string, userRole?: Role) {
    const outage = await prisma.outage.findFirst({
      where: { id: outageId, deletedAt: null },
      include: {
        area: { select: { id: true, name: true } },
      },
    });

    if (!outage) {
      throw AppError.notFound(`Outage with ID '${outageId}' not found.`);
    }

    const isPrivileged = userRole === Role.ADMIN || userRole === Role.POWER_OPERATOR;
    if (!isPrivileged && outage.status === OutageStatus.DRAFT) {
      throw AppError.notFound(`Outage with ID '${outageId}' not found.`);
    }

    const [auditLogs, assignments, reports] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          entity: 'Outage',
          entityId: outageId,
        },
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.technicianAssignment.findMany({
        where: { outageId },
        orderBy: { assignedAt: 'asc' },
        include: {
          technician: { select: { id: true, name: true, specialization: true } },
          assignedBy: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.outageReport.findMany({
        where: { outageId },
        orderBy: { createdAt: 'asc' },
        include: {
          customer: { select: { id: true, name: true } },
          verifiedBy: { select: { id: true, name: true, role: true } },
        },
      }),
    ]);

    // Format structured chronological timeline
    const timeline = auditLogs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt,
      action: log.action,
      performedBy: log.user ? { name: log.user.name, role: log.user.role } : null,
      details: log.details,
    }));

    return {
      outage: {
        id: outage.id,
        outageNumber: outage.outageNumber,
        title: outage.title,
        status: outage.status,
        type: outage.type,
        area: outage.area,
        startTime: outage.startTime,
        endTime: outage.endTime,
      },
      timeline,
      assignments,
      reports,
    };
  }
}
