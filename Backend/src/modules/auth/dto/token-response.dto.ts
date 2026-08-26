import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export class TokenResponseDto extends createZodDto(TokenResponseSchema) {}
