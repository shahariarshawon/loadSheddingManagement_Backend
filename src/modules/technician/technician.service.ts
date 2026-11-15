import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/appError.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { CreateTechnicianInput, UpdateTechnicianInput } from './technician.validation.js';
import { AssignmentStatus, Prisma } from '../../generated/prisma/client.js';

export class TechnicianService {
  /**
   * List technicians with zone and availability filtering, search, and pagination
   */
  static async listTechnicians(query: Record<string, unknown>) {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(
      query,
      ['name', 'phone', 'specialization', 'createdAt'],
      'name',
      'asc',
    );

    const zoneId = typeof query.zoneId === 'string' && query.zoneId ? query.zoneId : undefined;
    const search = typeof query.search === 'string' ? query.search.trim() : undefined;
    const isAvailable =
      query.isAvailable === 'true' || query.isAvailable === true
        ? true
        : query.isAvailable === 'false' || query.isAvailable === false
          ? false
          : undefined;

    const where: Prisma.TechnicianWhereInput = {
      deletedAt: null,
      ...(zoneId && { zoneId }),
      ...(isAvailable !== undefined && { isAvailable }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { specialization: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, technicians] = await Promise.all([
      prisma.technician.count({ where }),
      prisma.technician.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          zone: { select: { id: true, name: true, code: true } },
          _count: {
            select: {
              assignments: {
                where: {
                  status: {
                    in: [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS],
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      technicians,
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * Get single technician details with assignment history
   */
  static async getTechnicianById(id: string) {
    const technician = await prisma.technician.findFirst({
      where: { id, deletedAt: null },
      include: {
        zone: { select: { id: true, name: true, code: true } },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          take: 10,
          include: {
            outage: {
              select: {
                id: true,
                outageNumber: true,
                title: true,
                status: true,
                type: true,
              },
            },
            assignedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!technician) {
      throw AppError.notFound(`Technician with ID '${id}' not found.`);
    }

    return technician;
  }

  /**
   * Register a new technician (Admin only)
   */
  static async createTechnician(input: CreateTechnicianInput) {
    const zone = await prisma.zone.findFirst({
      where: { id: input.zoneId, deletedAt: null },
    });

    if (!zone) {
      throw AppError.badRequest(`Zone with ID '${input.zoneId}' does not exist.`);
    }

    const technician = await prisma.technician.create({
      data: {
        name: input.name,
        phone: input.phone,
        specialization: input.specialization || null,
        zoneId: input.zoneId,
        isAvailable: input.isAvailable !== undefined ? input.isAvailable : true,
      },
      include: {
        zone: { select: { id: true, name: true, code: true } },
      },
    });

    return technician;
  }

  /**
   * Update technician details or availability
   */
  static async updateTechnician(id: string, input: UpdateTechnicianInput) {
    const existing = await prisma.technician.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw AppError.notFound(`Technician with ID '${id}' not found.`);
    }

    if (input.zoneId) {
      const zone = await prisma.zone.findFirst({
        where: { id: input.zoneId, deletedAt: null },
      });
      if (!zone) {
        throw AppError.badRequest(`Zone with ID '${input.zoneId}' does not exist.`);
      }
    }

    const updated = await prisma.technician.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.specialization !== undefined && { specialization: input.specialization }),
        ...(input.zoneId !== undefined && { zoneId: input.zoneId }),
        ...(input.isAvailable !== undefined && { isAvailable: input.isAvailable }),
      },
      include: {
        zone: { select: { id: true, name: true, code: true } },
      },
    });

    return updated;
  }

  /**
   * Soft-delete technician with active assignment check
   */
  static async deleteTechnician(id: string) {
    const existing = await prisma.technician.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignments: {
          where: {
            status: {
              in: [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS],
            },
          },
        },
      },
    });

    if (!existing) {
      throw AppError.notFound(`Technician with ID '${id}' not found.`);
    }

    if (existing.assignments.length > 0) {
      throw AppError.badRequest(
        `Cannot delete technician '${existing.name}'. They have ${existing.assignments.length} active assignment(s). Please reassign or restore the active outages first.`,
      );
    }

    await prisma.technician.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { id, message: `Technician '${existing.name}' deleted successfully.` };
  }
}
