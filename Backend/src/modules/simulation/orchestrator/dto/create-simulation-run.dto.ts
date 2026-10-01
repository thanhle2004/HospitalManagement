import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const RoomConfigSchema = z.object({
  roomId: z.coerce.number().int().positive(),
  withDoctor: z.boolean().optional(),
  withDevice: z.boolean().optional(),
  useRoomTypeAvgProcessTime: z.boolean().optional().default(true),
  serviceTimeMeanSeconds: z.coerce.number().int().positive(),
  serviceTimeStdDevSeconds: z.coerce.number().int().min(0).optional(),
});

const ArrivalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('FIXED'), intervalMs: z.coerce.number().int().positive() }),
  z.object({ kind: z.literal('BURST'), atMs: z.coerce.number().int().min(0).optional() }),
]);

const BaseSimulationRunFields = {
  name: z.string().min(1).max(191),
  seed: z.coerce.number().int(),
  flowId: z.coerce.number().int().positive(),
  patientCount: z.coerce.number().int().min(1).max(1000),
  arrival: ArrivalSchema,
  noShowProbability: z.coerce.number().min(0).max(1).optional(),
  rooms: z.array(RoomConfigSchema).min(1).max(50),
  assertionSweepIntervalMs: z.coerce.number().int().positive().optional(),
  stuckThresholdMs: z.coerce.number().int().positive().optional(),
  routingMaxPendingMs: z.coerce.number().int().positive().optional(),
  // [Phase 6]
  clockPolicy: z.enum(['ASAP', 'PACED', 'STEP']).optional(),
  speed: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10), z.literal(50)]).optional(),
};

export const CreateSimulationRunSchema = z
  .object({
    ...BaseSimulationRunFields,
    // [Phase 5]
    mode: z.enum(['LOCKSTEP', 'CONCURRENT']).optional(),
    concurrencyLimit: z.coerce.number().int().positive().optional(),
  })
  .strict();

export class CreateSimulationRunDto extends createZodDto(CreateSimulationRunSchema) {}

/** [Phase 5] Input cho POST /runs/compare — giống hệt CreateSimulationRunDto
 * nhưng KHÔNG có `mode` (endpoint compare tự quyết định, chạy cả 2 mode).
 * Định nghĩa ĐỘC LẬP (không .omit() từ schema trên) để tránh phụ thuộc vào
 * hành vi giữ/không giữ `.strict()` của .omit() qua các version zod khác
 * nhau — an toàn hơn khi không kiểm thử được trực tiếp trong môi trường này. */
export const CompareSimulationRunSchema = z
  .object({
    ...BaseSimulationRunFields,
    concurrencyLimit: z.coerce.number().int().positive().optional(),
  })
  .strict();
export class CompareSimulationRunDto extends createZodDto(CompareSimulationRunSchema) {}

// [Phase 6]
export const UpdateSimulationSpeedSchema = z
  .object({
    speed: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10), z.literal(50)]),
  })
  .strict();
export class UpdateSimulationSpeedDto extends createZodDto(UpdateSimulationSpeedSchema) {}
