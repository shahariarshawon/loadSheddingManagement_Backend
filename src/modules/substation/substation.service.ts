import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/appError.js';
import { CreateSubstationInput, UpdateSubstationInput } from './substation.validation.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { Prisma } from '../../generated/prisma/client.js';

export class SubstationService {
  static async createSubstation(
    userId: string,
    input: CreateSubstationInput,
    ipAddress?: string,
  ) {
    const zone = await prisma.zone.findFirst({
      where: { id: input.zoneId, deletedAt: null },
    });
    if (!zone) {
      throw AppError.badRequest(`Parent Zone with ID '${input.zoneId}' does not exist.`);
    }

    const existingCode = await prisma.substation.findFirst({
      where: { code: input.code, deletedAt: null },
    });
    if (existingCode) {
      throw AppError.conflict(`A substation with code '${input.code}' already exists.`);
    }

    const [substation] = await prisma.$transaction([
      prisma.substation.create({
        data: {
          name: input.name,
          code: input.code,
          zoneId: input.zoneId,
          capacityKva: input.capacityKva || null,
        },
        include: {
          zone: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'SUBSTATION_CREATED',
          entity: 'Substation',
          details: { name: input.name, code: input.code, zoneId: input.zoneId },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return substation;
  }

  static async listSubstations(query: Record<string, unknown>) {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(
      query,
      ['name', 'code', 'capacityKva', 'createdAt'],
      'createdAt',
      'desc',
    );

    const zoneId = typeof query.zoneId === 'string' && query.zoneId ? query.zoneId : undefined;
    const search = typeof query.search === 'string' ? query.search.trim() : undefined;

    const where: Prisma.SubstationWhereInput = {
      deletedAt: null,
      ...(zoneId && { zoneId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, substations] = await Promise.all([
      prisma.substation.count({ where }),
      prisma.substation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          zone: { select: { id: true, name: true, code: true } },
          _count: {
            select: {
              feeders: { where: { deletedAt: null } },
            },
          },
        },
      }),
    ]);

    return {
      substations: substations.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        capacityKva: s.capacityKva,
        zone: s.zone,
        feederCount: s._count.feeders,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async getSubstationById(id: string) {
    const substation = await prisma.substation.findFirst({
      where: { id, deletedAt: null },
      include: {
        zone: { select: { id: true, name: true, code: true, description: true } },
        feeders: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            code: true,
            maxLoadKw: true,
            createdAt: true,
          },
        },
      },
    });

    if (!substation) {
      throw AppError.notFound(`Substation with ID '${id}' not found.`);
    }

    return substation;
  }

  static async updateSubstation(
    userId: string,
    id: string,
    input: UpdateSubstationInput,
    ipAddress?: string,
  ) {
    const existing = await prisma.substation.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw AppError.notFound(`Substation with ID '${id}' not found.`);
    }

    if (input.zoneId && input.zoneId !== existing.zoneId) {
      const zone = await prisma.zone.findFirst({
        where: { id: input.zoneId, deletedAt: null },
      });
      if (!zone) {
        throw AppError.badRequest(`Parent Zone with ID '${input.zoneId}' does not exist.`);
      }
    }

    if (input.code && input.code !== existing.code) {
      const codeTaken = await prisma.substation.findFirst({
        where: { code: input.code, id: { not: id }, deletedAt: null },
      });
      if (codeTaken) {
        throw AppError.conflict(`A substation with code '${input.code}' already exists.`);
      }
    }

    const [updated] = await prisma.$transaction([
      prisma.substation.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.code !== undefined && { code: input.code }),
          ...(input.zoneId !== undefined && { zoneId: input.zoneId }),
          ...(input.capacityKva !== undefined && { capacityKva: input.capacityKva }),
        },
        include: {
          zone: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'SUBSTATION_UPDATED',
          entity: 'Substation',
          entityId: id,
          details: { previous: { name: existing.name, code: existing.code }, updated: input },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return updated;
  }

  static async deleteSubstation(userId: string, id: string, ipAddress?: string) {
    const existing = await prisma.substation.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            feeders: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!existing) {
      throw AppError.notFound(`Substation with ID '${id}' not found.`);
    }

    if (existing._count.feeders > 0) {
      throw AppError.badRequest(
        `Cannot delete substation '${existing.name}'. It contains ${existing._count.feeders} active dependent feeder(s). Reassign or delete them first.`,
      );
    }

    const [deleted] = await prisma.$transaction([
      prisma.substation.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'SUBSTATION_DELETED',
          entity: 'Substation',
          entityId: id,
          details: { name: existing.name, code: existing.code },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return deleted;
  }
}
