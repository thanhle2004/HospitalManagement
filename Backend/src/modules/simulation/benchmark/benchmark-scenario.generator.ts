import { SeededRng } from '../engine/rng';
import { createHash } from 'node:crypto';
import {
  BenchmarkConfig,
  BenchmarkScenario,
  BenchmarkStepDefinition,
  WorkflowDependencyType,
} from './benchmark.types';

export const HOMOGENEOUS_EXPECTED_SECONDS = 300;
export const HETEROGENEOUS_EXPECTED_SECONDS: Record<string, number> = {
  SERVICE_A: 300,
  SERVICE_B: 600,
  SERVICE_C: 420,
  SERVICE_D: 900,
  SERVICE_E: 240,
};

type WorkflowStepTemplate = Pick<BenchmarkStepDefinition, 'id' | 'dependencies'>;

const WORKFLOWS: Record<WorkflowDependencyType, WorkflowStepTemplate[]> = {
  INDEPENDENT: ['A', 'B', 'C', 'D'].map((id) => ({ id: `SERVICE_${id}`, dependencies: [] })),
  SEQUENTIAL: [
    { id: 'SERVICE_A', dependencies: [] },
    { id: 'SERVICE_B', dependencies: ['SERVICE_A'] },
    { id: 'SERVICE_C', dependencies: ['SERVICE_B'] },
    { id: 'SERVICE_D', dependencies: ['SERVICE_C'] },
  ],
  PARTIAL: [
    { id: 'SERVICE_A', dependencies: [] },
    { id: 'SERVICE_B', dependencies: [] },
    { id: 'SERVICE_C', dependencies: ['SERVICE_A'] },
    { id: 'SERVICE_D', dependencies: ['SERVICE_B'] },
    { id: 'SERVICE_E', dependencies: ['SERVICE_C', 'SERVICE_D'] },
  ],
};

export function generateBenchmarkScenario(config: BenchmarkConfig): BenchmarkScenario {
  const rng = new SeededRng(config.seed);
  const steps = WORKFLOWS[config.workflow].map((step) => {
    const suffix = step.id.replace('SERVICE_', '');
    return {
      ...step,
      dependencies: [...step.dependencies],
      expectedAverageProcessTimeSeconds:
        config.processingProfile === 'HOMOGENEOUS'
          ? HOMOGENEOUS_EXPECTED_SECONDS
          : HETEROGENEOUS_EXPECTED_SECONDS[step.id],
      rooms: [`ROOM_${suffix}_1`, `ROOM_${suffix}_2`],
    };
  });
  const rooms = steps.flatMap((step, serviceIndex) =>
    [1, 2].map((roomIndex) => ({
      id: step.rooms[roomIndex - 1],
      serviceId: step.id,
      sortOrder: serviceIndex * 2 + roomIndex,
      expectedAverageProcessTimeSeconds: step.expectedAverageProcessTimeSeconds,
    })),
  );
  const patients = Array.from({ length: config.patientCount }, (_, index) => {
    const id = `P${String(index + 1).padStart(3, '0')}`;
    return {
      id,
      arrivalTimeMs: index * 10_000,
      serviceDurationsMs: Object.fromEntries(
        steps.map((step) => [
          step.id,
          Math.round(
            rng.uniform(
              `service-duration:${id}:${step.id}`,
              step.expectedAverageProcessTimeSeconds * 0.8,
              step.expectedAverageProcessTimeSeconds * 1.2,
            ),
          ) * 1_000,
        ]),
      ),
    };
  });

  const materialized = {
    schemaVersion: 1 as const,
    seed: config.seed,
    workflow: config.workflow,
    processingProfile: config.processingProfile,
    steps,
    rooms,
    patients,
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(materialized)).digest('hex');
  return { ...materialized, scenarioId: `SCN-${fingerprint.slice(0, 12).toUpperCase()}` };
}
