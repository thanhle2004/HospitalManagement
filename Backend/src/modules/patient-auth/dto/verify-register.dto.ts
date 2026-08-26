import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Gender } from '@prisma/client';

const vnPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
const otpCodeRegex = /^\d{4,8}$/;

export const VerifyRegisterSchema = z
  .object({
    phone: z.string().regex(vnPhoneRegex, 'Số điện thoại không hợp lệ'),
    otp: z.string().regex(otpCodeRegex, 'Mã OTP không hợp lệ'),

    // Thông tin cá nhân cơ bản — bắt buộc cung cấp ở lần đăng ký đầu tiên (§2.2)
    fullName: z.string().min(1, 'Họ tên không được để trống'),
    gender: z.nativeEnum(Gender).optional(),
    birthday: z.coerce.date().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    identityNumber: z.string().optional(),
    emergencyContact: z.string().optional(),

    // Không bắt buộc — nếu bỏ trống, hệ thống gán loại bệnh nhân mặc định (code "STANDARD")
    patientTypeId: z.coerce.number().int().positive().optional(),
  })
  .strict();

export class VerifyRegisterDto extends createZodDto(VerifyRegisterSchema) {}
