import { OtpPurpose } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const vnPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

export const RequestOtpChallengeSchema = z
  .object({
    phone: z.string().regex(vnPhoneRegex, 'Số điện thoại không hợp lệ'),
    purpose: z.nativeEnum(OtpPurpose),
  })
  .strict();

export class RequestOtpChallengeDto extends createZodDto(
  RequestOtpChallengeSchema,
) {}
