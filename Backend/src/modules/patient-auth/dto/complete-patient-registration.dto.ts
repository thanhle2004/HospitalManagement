import { Gender } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CompletePatientRegistrationSchema = z
  .object({
    registrationToken: z.string().min(1, 'Thiếu mã xác nhận đăng ký'),
    fullName: z.string().trim().min(1, 'Họ tên không được để trống'),
    gender: z.nativeEnum(Gender).optional(),
    birthday: z.coerce.date().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    identityNumber: z.string().optional(),
    emergencyContact: z.string().optional(),
  })
  .strict();

export class CompletePatientRegistrationDto extends createZodDto(
  CompletePatientRegistrationSchema,
) {}
