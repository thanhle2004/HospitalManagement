import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Gender } from '@prisma/client';

export const UpdateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(30).optional(),
    avatarUrl: z.string().trim().url().max(2048).optional(),
    gender: z.nativeEnum(Gender).optional(),
    birthday: z.coerce.date().optional(),
    address: z.string().trim().max(500).optional(),
    description: z.string().trim().max(1000).optional(),
  })
  .strict();

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
