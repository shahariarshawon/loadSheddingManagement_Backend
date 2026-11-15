import crypto from 'node:crypto';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { Role } from '../generated/prisma/client.js';
import { env } from '../config/env.js';

export interface TokenUserPayload {
  userId: string;
  email: string;
  role: Role;
}

export function signAccessToken(payload: TokenUserPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(payload: { userId: string }): string {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    options,
  );
}

export function verifyAccessToken(token: string): TokenUserPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenUserPayload;
}

export function verifyRefreshToken(token: string): JwtPayload & { userId: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload & { userId: string };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
