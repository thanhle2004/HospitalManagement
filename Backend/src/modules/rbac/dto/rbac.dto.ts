import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CodeSchema = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[a-z][a-z0-9_.-]*$/i, 'Mã chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới');

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export class RbacPaginationDto extends createZodDto(PaginationSchema) {}

export const CreateRoleSchema = z
  .object({
    code: CodeSchema.transform((value) => value.toUpperCase()),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    permissionCodes: z.array(CodeSchema).max(200).default([]),
  })
  .strict();
export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}

export const UpdateRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    permissionCodes: z.array(CodeSchema).max(200).optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}

export const AssignRoleSchema = z
  .object({
    roleCode: CodeSchema.transform((value) => value.toUpperCase()),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
export class AssignRoleDto extends createZodDto(AssignRoleSchema) {}

export const RevokeRoleSchema = z
  .object({ reason: z.string().trim().min(3).max(500) })
  .strict();
export class RevokeRoleDto extends createZodDto(RevokeRoleSchema) {}
