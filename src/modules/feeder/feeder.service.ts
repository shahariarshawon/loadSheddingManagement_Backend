import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/appError.js';
import { CreateFeederInput, UpdateFeederInput } from './feeder.validation.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { Prisma } from '../../generated/prisma/client.js';

export class FeederService {
  static async createFeeder(userId: string, input: CreateFeederInput, ipAddress?: string) {
    const substation = await prisma.substation.findFirst({
      where: { id: input.substationId, deletedAt: null },
    });
    if (!substation) {
      throw AppError.badRequest(`Parent Substation with ID '${input.substationId}' does not exist.`);
    }

    const existingCode = await prisma.feeder.findFirst({
      where: { code: input.code, deletedAt: null },
    });
    if (existingCode) {
      throw AppError.conflict(`A feeder with code '${input.code}' already exists.`);
    }

    const [feeder] = await prisma.$transaction([
      prisma.feeder.create({
        data: {
          name: input.name,
          code: input.code,
          substationId: input.substationId,
          maxLoadKw: input.maxLoadKw || null,
        },
        include: {
          substation: { select: { id: true, name: true, code: true, zoneId: true } },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'FEEDER_CREATED',
          entity: 'Feeder',
          details: { name: input.name, code: input.code, substationId: input.substationId },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return feeder;
  }

  static async listFeeders(query: Record<string, unknown>) {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(
      query,
      ['name', 'code', 'maxLoadKw', 'createdAt'],
      'createdAt',
      'desc',
    );

    const substationId =
      typeof query.substationId === 'string' && query.substationId ? query.substationId : undefined;
    const zoneId = typeof query.zoneId === 'string' && query.zoneId ? query.zoneId : undefined;
    const search = typeof query.search === 'string' ? query.search.trim() : undefined;

    const where: Prisma.FeederWhereInput = {
      deletedAt: null,
      ...(substationId && { substationId }),
      ...(zoneId && { substation: { zoneId, deletedAt: null } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, feeders] = await Promise.all([
      prisma.feeder.count({ where }),
      prisma.feeder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          substation: {
            select: {
              id: true,
              name: true,
              code: true,
              zone: { select: { id: true, name: true, code: true } },
            },
          },
          _count: {
            select: {
              areas: { where: { deletedAt: null } },
            },
          },
        },
      }),
    ]);

    return {
      feeders: feeders.map((f) => ({
        id: f.id,
        name: f.name,
        code: f.code,
        maxLoadKw: f.maxLoadKw,
        substation: f.substation,
        areaCount: f._count.areas,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async getFeederById(id: string) {
    const feeder = await prisma.feeder.findFirst({
      where: { id, deletedAt: null },
      include: {
        substation: {
          select: {
            id: true,
            name: true,
            code: true,
            capacityKva: true,
            zone: { select: { id: true, name: true, code: true } },
          },
        },
        areas: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            postalCode: true,
            createdAt: true,
          },
        },
      },
    });

    if (!feeder) {
      throw AppError.notFound(`Feeder with ID '${id}' not found.`);
    }

    return feeder;
  }

  static async updateFeeder(
    userId: string,
    id: string,
    input: UpdateFeederInput,
    ipAddress?: string,
  ) {
    const existing = await prisma.feeder.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw AppError.notFound(`Feeder with ID '${id}' not found.`);
    }

    if (input.substationId && input.substationId !== existing.substationId) {
      const substation = await prisma.substation.findFirst({
        where: { id: input.substationId, deletedAt: null },
      });
      if (!substation) {
        throw AppError.badRequest(`Parent Substation with ID '${input.substationId}' does not exist.`);
      }
    }

    if (input.code && input.code !== existing.code) {
      const codeTaken = await prisma.feeder.findFirst({
        where: { code: input.code, id: { not: id }, deletedAt: null },
      });
      if (codeTaken) {
        throw AppError.conflict(`A feeder with code '${input.code}' already exists.`);
      }
    }

    const [updated] = await prisma.$transaction([
      prisma.feeder.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.code !== undefined && { code: input.code }),
          ...(input.substationId !== undefined && { substationId: input.substationId }),
          ...(input.maxLoadKw !== undefined && { maxLoadKw: input.maxLoadKw }),
        },
        include: {
          substation: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'FEEDER_UPDATED',
          entity: 'Feeder',
          entityId: id,
          details: { previous: { name: existing.name, code: existing.code }, updated: input },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return updated;
  }

  static async deleteFeeder(userId: string, id: string, ipAddress?: string) {
    const existing = await prisma.feeder.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            areas: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!existing) {
      throw AppError.notFound(`Feeder with ID '${id}' not found.`);
    }

    if (existing._count.areas > 0) {
      throw AppError.badRequest(
        `Cannot delete feeder '${existing.name}'. It contains ${existing._count.areas} active dependent area(s). Reassign or delete them first.`,
      );
    }

    const [deleted] = await prisma.$transaction([
      prisma.feeder.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'FEEDER_DELETED',
          entity: 'Feeder',
          entityId: id,
          details: { name: existing.name, code: existing.code },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return deleted;
  }
}
