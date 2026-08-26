import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Gender } from '@prisma/client';

export const CreateDoctorSchema = z
  .object({
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    fullName: z.string().min(1, 'Họ tên không được để trống'),
    phone: z.string().optional(),
    gender: z.nativeEnum(Gender).optional(),
    // z.coerce.date() tự parse chuỗi "1990-01-01" hoặc ISO datetime thành Date
    // -> service không cần tự `new Date(dto.birthday)` nữa
    birthday: z.coerce.date().optional(),
    address: z.string().optional(),
  })
  .strict();

export class CreateDoctorDto extends createZodDto(CreateDoctorSchema) {}
