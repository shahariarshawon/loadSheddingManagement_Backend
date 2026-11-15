import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/appError.js';
import { CreateZoneInput, UpdateZoneInput } from './zone.validation.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { Prisma } from '../../generated/prisma/client.js';

export class ZoneService {
  static async createZone(userId: string, input: CreateZoneInput, ipAddress?: string) {
    const existing = await prisma.zone.findFirst({
      where: { code: input.code, deletedAt: null },
    });
    if (existing) {
      throw AppError.conflict(`A zone with code '${input.code}' already exists.`);
    }

    const [zone] = await prisma.$transaction([
      prisma.zone.create({
        data: {
          name: input.name,
          code: input.code,
          description: input.description || null,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'ZONE_CREATED',
          entity: 'Zone',
          details: { name: input.name, code: input.code },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return zone;
  }

  static async listZones(query: Record<string, unknown>) {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(
      query,
      ['name', 'code', 'createdAt'],
      'createdAt',
      'desc',
    );

    const search = typeof query.search === 'string' ? query.search.trim() : undefined;

    const where: Prisma.ZoneWhereInput = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, zones] = await Promise.all([
      prisma.zone.count({ where }),
      prisma.zone.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              substations: { where: { deletedAt: null } },
              technicians: { where: { deletedAt: null } },
            },
          },
        },
      }),
    ]);

    return {
      zones: zones.map((z) => ({
        id: z.id,
        name: z.name,
        code: z.code,
        description: z.description,
        createdAt: z.createdAt,
        updatedAt: z.updatedAt,
        substationCount: z._count.substations,
        technicianCount: z._count.technicians,
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async getZoneById(id: string) {
    const zone = await prisma.zone.findFirst({
      where: { id, deletedAt: null },
      include: {
        substations: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            code: true,
            capacityKva: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            technicians: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!zone) {
      throw AppError.notFound(`Zone with ID '${id}' not found.`);
    }

    return zone;
  }

  static async updateZone(
    userId: string,
    id: string,
    input: UpdateZoneInput,
    ipAddress?: string,
  ) {
    const existing = await prisma.zone.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw AppError.notFound(`Zone with ID '${id}' not found.`);
    }

    if (input.code && input.code !== existing.code) {
      const codeTaken = await prisma.zone.findFirst({
        where: { code: input.code, id: { not: id }, deletedAt: null },
      });
      if (codeTaken) {
        throw AppError.conflict(`A zone with code '${input.code}' already exists.`);
      }
    }

    const [updated] = await prisma.$transaction([
      prisma.zone.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.code !== undefined && { code: input.code }),
          ...(input.description !== undefined && { description: input.description }),
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'ZONE_UPDATED',
          entity: 'Zone',
          entityId: id,
          details: { previous: { name: existing.name, code: existing.code }, updated: input },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return updated;
  }

  static async deleteZone(userId: string, id: string, ipAddress?: string) {
    const existing = await prisma.zone.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            substations: { where: { deletedAt: null } },
            technicians: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!existing) {
      throw AppError.notFound(`Zone with ID '${id}' not found.`);
    }

    if (existing._count.substations > 0) {
      throw AppError.badRequest(
        `Cannot delete zone '${existing.name}'. It contains ${existing._count.substations} active dependent substation(s). Reassign or delete them first.`,
      );
    }

    if (existing._count.technicians > 0) {
      throw AppError.badRequest(
        `Cannot delete zone '${existing.name}'. It contains ${existing._count.technicians} assigned technician(s). Reassign them first.`,
      );
    }

    const [deleted] = await prisma.$transaction([
      prisma.zone.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'ZONE_DELETED',
          entity: 'Zone',
          entityId: id,
          details: { name: existing.name, code: existing.code },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return deleted;
  }
}
