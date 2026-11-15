import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/appError.js';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';
import { Role, User } from '../../generated/prisma/client.js';
import { LoginInput, RegisterInput } from './auth.validation.js';

export function sanitizeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    areaId: user.areaId,
    googleId: user.googleId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class AuthService {
  /**
   * Register a new Customer with email/password
   */
  static async register(input: RegisterInput) {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: input.email,
        deletedAt: null,
      },
    });

    if (existingUser) {
      throw AppError.conflict('Email is already registered. Please log in or use another email.');
    }

    if (input.areaId) {
      const areaExists = await prisma.area.findFirst({
        where: { id: input.areaId, deletedAt: null },
      });
      if (!areaExists) {
        throw AppError.badRequest('Specified residential area does not exist.');
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    // Strictly enforce CUSTOMER role for public registration
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        phone: input.phone || null,
        areaId: input.areaId || null,
        role: Role.CUSTOMER,
        isActive: true,
      },
    });

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = signRefreshToken({ userId: user.id });
    const tokenHash = hashToken(refreshToken);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login with email and password
   */
  static async login(input: LoginInput) {
    const user = await prisma.user.findFirst({
      where: {
        email: input.email,
        deletedAt: null,
      },
    });

    // Uniform response to prevent email enumeration
    if (!user || !user.passwordHash) {
      throw AppError.badRequest('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw AppError.badRequest('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new AppError('Account is disabled or suspended. Please contact support.', 403);
    }

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = signRefreshToken({ userId: user.id });
    const tokenHash = hashToken(refreshToken);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Google Social Login / Register via Verified GCP ID Token
   */
  static async googleLogin(idToken: string) {
    if (!env.GOOGLE_CLIENT_ID) {
      throw AppError.badRequest('Google OAuth is not configured on the server. Please configure GOOGLE_CLIENT_ID.');
    }

    const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    let payload;

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err: unknown) {
      const error = err as Error;
      throw AppError.badRequest(`Google token verification failed: ${error.message}`);
    }

    if (!payload || !payload.email) {
      throw AppError.badRequest('Google token did not contain an email address.');
    }

    if (!payload.email_verified) {
      throw AppError.badRequest('Google email must be verified to log in.');
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name || email.split('@')[0] || 'Google User';

    // Find existing user by googleId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
        deletedAt: null,
      },
    });

    if (user) {
      if (!user.googleId) {
        // Link Google ID to existing email account
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
      }

      if (!user.isActive) {
        throw new AppError('Account is disabled or suspended. Please contact support.', 403);
      }
    } else {
      // Create new customer account with verified Google identity
      user = await prisma.user.create({
        data: {
          name,
          email,
          googleId,
          role: Role.CUSTOMER,
          isActive: true,
        },
      });
    }

    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = signRefreshToken({ userId: user.id });
    const tokenHash = hashToken(refreshToken);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Rotate Refresh Token & Issue New Access Token
   */
  static async refresh(token: string) {
    try {
      verifyRefreshToken(token);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'TokenExpiredError') {
        throw AppError.unauthorized('Refresh token has expired. Please log in again.');
      }
      throw AppError.unauthorized('Invalid refresh token.');
    }

    const tokenHash = hashToken(token);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt !== null || storedToken.expiresAt < new Date()) {
      // If token is reused after revocation, security risk: reject
      throw AppError.unauthorized('Invalid, revoked, or expired refresh token.');
    }

    if (!storedToken.user || storedToken.user.deletedAt !== null || !storedToken.user.isActive) {
      throw AppError.unauthorized('User account is invalid or suspended.');
    }

    const newAccessToken = signAccessToken({
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    });

    const newRefreshToken = signRefreshToken({ userId: storedToken.user.id });
    const newTokenHash = hashToken(newRefreshToken);

    // Atomically rotate: revoke old token and insert new token
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          userId: storedToken.user.id,
          tokenHash: newTokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Invalidate Refresh Token on Logout
   */
  static async logout(token: string) {
    const tokenHash = hashToken(token);

    await prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
