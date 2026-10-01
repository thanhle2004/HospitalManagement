import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const BenchmarkAlgorithmSchema = z.enum([
  'SYSTEM',
  'SHORTEST_QUEUE',
  'ROUND_ROBIN',
  'RANDOM',
  'LEAST_UTILISED',
]);
export const WorkflowDependencySchema = z.enum(['INDEPENDENT', 'SEQUENTIAL', 'PARTIAL']);

const BenchmarkBaseSchema = z.object({
  patientCount: z.coerce.number().int().min(1).max(1000),
  workflow: WorkflowDependencySchema,
  seed: z.coerce.number().int().min(0).max(2_147_483_647).default(20261002),
});

export const RunBenchmarkSchema = BenchmarkBaseSchema.extend({
  algorithm: BenchmarkAlgorithmSchema,
}).strict();

export const CompareBenchmarkSchema = BenchmarkBaseSchema.extend({
  algorithms: z.array(BenchmarkAlgorithmSchema).min(2).max(5).refine(
    (algorithms) => new Set(algorithms).size === algorithms.length,
    'Algorithms must be unique',
  ),
}).strict();

export class RunBenchmarkDto extends createZodDto(RunBenchmarkSchema) {}
export class CompareBenchmarkDto extends createZodDto(CompareBenchmarkSchema) {}
