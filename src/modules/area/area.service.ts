import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/appError.js';
import { CreateAreaInput, UpdateAreaInput } from './area.validation.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { Prisma } from '../../generated/prisma/client.js';

export class AreaService {
  static async createArea(userId: string, input: CreateAreaInput, ipAddress?: string) {
    const feeder = await prisma.feeder.findFirst({
      where: { id: input.feederId, deletedAt: null },
    });
    if (!feeder) {
      throw AppError.badRequest(`Parent Feeder with ID '${input.feederId}' does not exist.`);
    }

    const [area] = await prisma.$transaction([
      prisma.area.create({
        data: {
          name: input.name,
          postalCode: input.postalCode || null,
          feederId: input.feederId,
        },
        include: {
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
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'AREA_CREATED',
          entity: 'Area',
          details: { name: input.name, feederId: input.feederId, postalCode: input.postalCode },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return area;
  }

  static async listAreas(query: Record<string, unknown>) {
    const { page, limit, skip, sortBy, sortOrder } = parsePagination(
      query,
      ['name', 'postalCode', 'createdAt'],
      'createdAt',
      'desc',
    );

    const feederId =
      typeof query.feederId === 'string' && query.feederId ? query.feederId : undefined;
    const substationId =
      typeof query.substationId === 'string' && query.substationId ? query.substationId : undefined;
    const zoneId = typeof query.zoneId === 'string' && query.zoneId ? query.zoneId : undefined;
    const search = typeof query.search === 'string' ? query.search.trim() : undefined;

    const where: Prisma.AreaWhereInput = {
      deletedAt: null,
      ...(feederId && { feederId }),
      ...(substationId && { feeder: { substationId, deletedAt: null } }),
      ...(zoneId && { feeder: { substation: { zoneId, deletedAt: null }, deletedAt: null } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { postalCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, areas] = await Promise.all([
      prisma.area.count({ where }),
      prisma.area.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
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
          _count: {
            select: {
              users: { where: { deletedAt: null } },
              outages: { where: { deletedAt: null } },
            },
          },
        },
      }),
    ]);

    return {
      areas: areas.map((a) => ({
        id: a.id,
        name: a.name,
        postalCode: a.postalCode,
        feeder: a.feeder,
        userCount: a._count.users,
        outageCount: a._count.outages,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  static async getAreaById(id: string) {
    const area = await prisma.area.findFirst({
      where: { id, deletedAt: null },
      include: {
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
    });

    if (!area) {
      throw AppError.notFound(`Area with ID '${id}' not found.`);
    }

    return area;
  }

  static async updateArea(
    userId: string,
    id: string,
    input: UpdateAreaInput,
    ipAddress?: string,
  ) {
    const existing = await prisma.area.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw AppError.notFound(`Area with ID '${id}' not found.`);
    }

    if (input.feederId && input.feederId !== existing.feederId) {
      const feeder = await prisma.feeder.findFirst({
        where: { id: input.feederId, deletedAt: null },
      });
      if (!feeder) {
        throw AppError.badRequest(`Parent Feeder with ID '${input.feederId}' does not exist.`);
      }
    }

    const [updated] = await prisma.$transaction([
      prisma.area.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.postalCode !== undefined && { postalCode: input.postalCode }),
          ...(input.feederId !== undefined && { feederId: input.feederId }),
        },
        include: {
          feeder: {
            select: {
              id: true,
              name: true,
              code: true,
              substation: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'AREA_UPDATED',
          entity: 'Area',
          entityId: id,
          details: { previous: { name: existing.name }, updated: input },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return updated;
  }

  static async deleteArea(userId: string, id: string, ipAddress?: string) {
    const existing = await prisma.area.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            users: { where: { deletedAt: null } },
            outages: { where: { deletedAt: null, status: { in: ['ACTIVE', 'IN_PROGRESS'] } } },
          },
        },
      },
    });

    if (!existing) {
      throw AppError.notFound(`Area with ID '${id}' not found.`);
    }

    if (existing._count.outages > 0) {
      throw AppError.badRequest(
        `Cannot delete area '${existing.name}'. It has ${existing._count.outages} active outage(s) currently ongoing.`,
      );
    }

    const [deleted] = await prisma.$transaction([
      prisma.area.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'AREA_DELETED',
          entity: 'Area',
          entityId: id,
          details: { name: existing.name },
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return deleted;
  }
}
