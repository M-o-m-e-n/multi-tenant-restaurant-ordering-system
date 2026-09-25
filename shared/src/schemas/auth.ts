import { z } from 'zod';

import { ROLES } from '../domain/enums';

const email = z
  .string()
  .trim()
  .email('Enter a valid email address.')
  .max(255)
  .transform((e) => e.toLowerCase());

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name.').max(120),
    email,
    password: z.string().min(8, 'Use at least 8 characters.').max(128),
  })
  .strict();
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1, 'Enter your password.').max(128),
  })
  .strict();
export type LoginDto = z.infer<typeof loginSchema>;

export const familyIdParamSchema = z.object({ familyId: z.string().uuid() }).strict();

export const userRoleSchema = z.enum(ROLES);

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: z.infer<typeof userRoleSchema>;
  phone?: string | null;
}

export interface AuthResponse {
  user: UserDto;
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export interface SessionDto {
  familyId: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}
