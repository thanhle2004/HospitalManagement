import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const vnPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
const otpCodeRegex = /^\d{4,8}$/;

export const VerifyLoginSchema = z
  .object({
    phone: z.string().regex(vnPhoneRegex, 'Số điện thoại không hợp lệ'),
    otp: z.string().regex(otpCodeRegex, 'Mã OTP không hợp lệ'),
  })
  .strict();

export class VerifyLoginDto extends createZodDto(VerifyLoginSchema) {}
