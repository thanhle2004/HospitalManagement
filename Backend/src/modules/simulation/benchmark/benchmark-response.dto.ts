import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { BenchmarkAlgorithmSchema, WorkflowDependencySchema } from './benchmark.dto';

const MetricsSchema = z.object({
  averageWaitingTimeMs: z.number(), p95WaitingTimeMs: z.number(), maxWaitingTimeMs: z.number(),
  averageLengthOfStayMs: z.number(), throughputPerSimHour: z.number(),
  averageRoomUtilizationPct: z.number(), completedPatientCount: z.number().int(),
});
const EventSchema = z.object({ simTimeMs: z.number(), type: z.enum(['ARRIVED', 'STEP_READY', 'QUEUED', 'SERVICE_STARTED', 'SERVICE_COMPLETED', 'PATIENT_COMPLETED']), patientId: z.string(), serviceId: z.string().optional(), roomId: z.string().optional() });
const RoomSchema = z.object({ roomId: z.string(), serviceId: z.string(), patientsServed: z.number().int(), busyTimeMs: z.number(), utilizationPct: z.number() });
export const BenchmarkRunResultSchema = z.object({
  algorithm: BenchmarkAlgorithmSchema, algorithmLabel: z.string(), seed: z.number().int(),
  workflow: WorkflowDependencySchema, patientCount: z.number().int(), simulationTimeMs: z.number(),
  metrics: MetricsSchema, rooms: z.array(RoomSchema), events: z.array(EventSchema),
});
const envelope = <T extends z.ZodTypeAny>(data: T) => z.object({ success: z.literal(true), statusCode: z.number().int(), requestId: z.string(), timestamp: z.string(), data });
export class BenchmarkRunEnvelopeDto extends createZodDto(envelope(BenchmarkRunResultSchema)) {}
export class BenchmarkCompareEnvelopeDto extends createZodDto(envelope(z.object({
  scenario: z.object({ patientCount: z.number().int(), workflow: WorkflowDependencySchema, seed: z.number().int(), schemaVersion: z.literal(1) }),
  results: z.array(BenchmarkRunResultSchema),
}))) {}
