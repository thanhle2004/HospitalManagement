import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Gender, UserRole, UserStatus } from '@prisma/client';

export const UserProfileResponseSchema = z.object({
  fullName: z.string(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  gender: z.nativeEnum(Gender).nullable(),
  birthday: z.date().nullable(),
  address: z.string().nullable(),
  description: z.string().nullable(),
});

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  lastLoginAt: z.date().nullable(),
  createdAt: z.date(),
  profile: UserProfileResponseSchema.nullable(),
  // Cố ý KHÔNG có passwordHash ở đây
});

export class UserResponseDto extends createZodDto(UserResponseSchema) {}
