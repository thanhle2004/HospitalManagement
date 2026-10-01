import { UserRole } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const StaffRoleSchema = z.enum([
  UserRole.ADMIN,
  UserRole.DOCTOR,
  UserRole.NURSE,
  UserRole.RECEPTIONIST,
  UserRole.LAB_TECHNICIAN,
  UserRole.PHARMACIST,
  UserRole.CASHIER,
]);

export const CreateStaffSchema = z
  .object({
    email: z.string().trim().email('Email không hợp lệ').transform((value) => value.toLowerCase()),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(128),
    fullName: z.string().trim().min(1, 'Họ tên không được để trống').max(150),
    phone: z.string().trim().max(30).optional(),
    role: StaffRoleSchema,
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export class CreateStaffDto extends createZodDto(CreateStaffSchema) {}

export const UpdateStaffStatusSchema = z
  .object({
    status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export class UpdateStaffStatusDto extends createZodDto(UpdateStaffStatusSchema) {}
