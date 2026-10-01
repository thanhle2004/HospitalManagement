import { SeededRng } from '../engine/rng';
import {
  BenchmarkConfig,
  BenchmarkScenario,
  BenchmarkStepDefinition,
  WorkflowDependencyType,
} from './benchmark.types';

const WORKFLOWS: Record<WorkflowDependencyType, BenchmarkStepDefinition[]> = {
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
  const steps = WORKFLOWS[config.workflow].map((step) => ({
    ...step,
    dependencies: [...step.dependencies],
  }));
  const rooms = steps.flatMap((step, serviceIndex) =>
    [1, 2].map((roomIndex) => ({
      id: `ROOM_${step.id.replace('SERVICE_', '')}_${roomIndex}`,
      serviceId: step.id,
      sortOrder: serviceIndex * 2 + roomIndex,
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
          Math.round(rng.uniform(`service-duration:${id}:${step.id}`, 45, 121)) * 1_000,
        ]),
      ),
    };
  });

  return { schemaVersion: 1, seed: config.seed, workflow: config.workflow, steps, rooms, patients };
}
