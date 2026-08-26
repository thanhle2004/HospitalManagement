import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// Số điện thoại di động VN: 0xxxxxxxxx hoặc +84xxxxxxxxx
const vnPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

export const RequestOtpSchema = z
  .object({
    phone: z
      .string()
      .regex(vnPhoneRegex, 'Số điện thoại không hợp lệ (định dạng VN)'),
  })
  .strict();

export class RequestOtpDto extends createZodDto(RequestOtpSchema) {}
