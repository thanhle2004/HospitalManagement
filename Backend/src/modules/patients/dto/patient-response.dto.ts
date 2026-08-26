import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Gender } from '@prisma/client';

export const PatientResponseSchema = z.object({
  id: z.string(),
  phone: z.string(),
  fullName: z.string(),
  gender: z.nativeEnum(Gender).nullable(),
  birthday: z.date().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  identityNumber: z.string().nullable(),
  emergencyContact: z.string().nullable(),
  patientType: z.object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
  }),
  createdAt: z.date(),
});

export class PatientResponseDto extends createZodDto(PatientResponseSchema) {}
