import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be under 100 characters'),
  email: z.string().trim().toLowerCase().email('Invalid email address').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password must be under 100 characters'),
  phone: z.string().trim().max(20).optional(),
  areaId: z.string().trim().min(1, 'Area ID must not be empty').optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(10, 'Google ID token is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
