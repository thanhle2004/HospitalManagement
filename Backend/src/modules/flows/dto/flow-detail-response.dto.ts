import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const FlowStepNodeSchema = z.object({
  id: z.number(),
  code: z.string(),
  displayOrder: z.number(),
  isOptional: z.boolean(),
  roomType: z.object({ id: z.number(), name: z.string() }),
  // Danh sách requiredStepId — chính là cạnh (edge) của đồ thị DAG, đọc là
  // "step này phụ thuộc vào các step trong dependsOn"
  dependsOn: z.array(z.number()),
});

export const FlowDetailResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  steps: z.array(FlowStepNodeSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export class FlowDetailResponseDto extends createZodDto(
  FlowDetailResponseSchema,
) {}
