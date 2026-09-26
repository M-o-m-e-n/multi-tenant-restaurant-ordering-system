import { z } from 'zod';

import { ROLES } from '../domain/enums';
import { phoneNumber } from './common';

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

/** POST /staff/users — an admin provisions a staff or admin account (AUTH-08, ADM-02). */
export const createStaffUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email,
    password: z.string().min(8).max(128),
    role: userRoleSchema,
    phone: phoneNumber.optional(),
  })
  .strict();
export type CreateStaffUserDto = z.infer<typeof createStaffUserSchema>;

/** PATCH /staff/users/:id — change role or disable (ADM-02). */
export const updateUserSchema = z
  .object({
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) => v.role !== undefined || v.isActive !== undefined,
    'Change the role or the status.',
  );
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export interface AdminUserDto extends UserDto {
  isActive: boolean;
  createdAt: string;
}
