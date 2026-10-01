import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { UserResponseSchema } from '../../users/dto/user-response.dto';

export const StaffWorkspaceSchema = z.enum(['ADMIN', 'DOCTOR']);

export const StaffCurrentSessionSchema = UserResponseSchema.extend({
  effectiveRoles: z.array(z.string()),
  effectivePermissions: z.array(z.string()),
  workspace: StaffWorkspaceSchema.nullable(),
});

export class StaffCurrentSessionDto extends createZodDto(
  StaffCurrentSessionSchema,
) {}

export const StaffCurrentSessionEnvelopeSchema = z.object({
  success: z.literal(true),
  statusCode: z.number().int(),
  requestId: z.string(),
  timestamp: z.string(),
  data: StaffCurrentSessionSchema,
});

export class StaffCurrentSessionEnvelopeDto extends createZodDto(
  StaffCurrentSessionEnvelopeSchema,
) {}
