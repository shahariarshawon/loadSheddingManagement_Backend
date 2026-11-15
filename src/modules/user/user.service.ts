import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/appError.js';
import { UpdateProfileInput } from './user.validation.js';

export class UserService {
  static async getProfile(userId: string) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
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
    });

    if (!user) {
      throw AppError.notFound('User profile not found.');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      areaId: user.areaId,
      area: user.area,
      googleId: user.googleId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static async updateProfile(userId: string, input: UpdateProfileInput) {
    if (input.areaId) {
      const areaExists = await prisma.area.findFirst({
        where: { id: input.areaId, deletedAt: null },
      });
      if (!areaExists) {
        throw AppError.badRequest('Specified area does not exist.');
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.areaId !== undefined && { areaId: input.areaId }),
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
    });

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      areaId: updatedUser.areaId,
      area: updatedUser.area,
      googleId: updatedUser.googleId,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }
}
