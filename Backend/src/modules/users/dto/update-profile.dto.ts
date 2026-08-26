import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Gender } from '@prisma/client';

export const UpdateProfileSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    phone: z.string().optional(),
    avatarUrl: z.string().optional(),
    gender: z.nativeEnum(Gender).optional(),
    birthday: z.coerce.date().optional(),
    address: z.string().optional(),
    description: z.string().optional(),
  })
  .strict();

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
