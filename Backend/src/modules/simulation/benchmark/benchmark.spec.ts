import { MinEstimatedWaitingTimeStrategy } from '../../routing/strategies/min-estimated-waiting-time.strategy';
import { generateBenchmarkScenario } from './benchmark-scenario.generator';
import { createBenchmarkStrategy } from './benchmark-strategy.factory';
import { runBenchmarkScenario } from './benchmark-runner';
import { BenchmarkConfig, WorkflowDependencyType } from './benchmark.types';

const base: BenchmarkConfig = { patientCount: 8, workflow: 'SEQUENTIAL', seed: 42 };

describe('pure routing algorithm benchmark', () => {
  it.each([
    ['INDEPENDENT', [0, 0, 0, 0]],
    ['SEQUENTIAL', [0, 1, 1, 1]],
    ['PARTIAL', [0, 0, 1, 1, 2]],
  ] as Array<[WorkflowDependencyType, number[]]>)('materializes %s workflow dependencies', (workflow, counts) => {
    const scenario = generateBenchmarkScenario({ ...base, workflow });
    expect(scenario.steps.map((step) => step.dependencies.length)).toEqual(counts);
  });

  it('generates the exact patient count and is deterministic for the same config', () => {
    const first = generateBenchmarkScenario(base);
    const second = generateBenchmarkScenario(base);
    expect(first.patients).toHaveLength(8);
    expect(first).toEqual(second);
    expect(first.patients[0].id).toBe('P001');
    expect(first.rooms[0].id).toBe('ROOM_A_1');
  });

  it('resolves SYSTEM directly to the production strategy implementation', () => {
    expect(createBenchmarkStrategy('SYSTEM')).toBeInstanceOf(MinEstimatedWaitingTimeStrategy);
  });

  it('creates fresh instances for stateful strategies', () => {
    expect(createBenchmarkStrategy('ROUND_ROBIN')).not.toBe(createBenchmarkStrategy('ROUND_ROBIN'));
    expect(createBenchmarkStrategy('LEAST_UTILISED')).not.toBe(createBenchmarkStrategy('LEAST_UTILISED'));
  });

  it('keeps RANDOM deterministic for the same scenario seed', () => {
    const scenario = generateBenchmarkScenario(base);
    expect(runBenchmarkScenario(scenario, 'RANDOM')).toEqual(runBenchmarkScenario(scenario, 'RANDOM'));
  });

  it.each(['INDEPENDENT', 'SEQUENTIAL', 'PARTIAL'] as WorkflowDependencyType[])(
    'unlocks dependencies and completes every patient for %s',
    (workflow) => {
      const scenario = generateBenchmarkScenario({ ...base, workflow });
      const before = structuredClone(scenario);
      const result = runBenchmarkScenario(scenario, 'SYSTEM');
      expect(scenario).toEqual(before);
      expect(result.metrics.completedPatientCount).toBe(base.patientCount);
      const completions = result.events.filter((event) => event.type === 'PATIENT_COMPLETED');
      expect(completions).toHaveLength(base.patientCount);
      for (const patient of scenario.patients) {
        const patientEvents = result.events.filter((event) => event.patientId === patient.id);
        for (const step of scenario.steps) {
          const started = patientEvents.find((event) => event.type === 'SERVICE_STARTED' && event.serviceId === step.id);
          expect(started).toBeDefined();
          for (const dependency of step.dependencies) {
            const dependencyCompleted = patientEvents.find((event) => event.type === 'SERVICE_COMPLETED' && event.serviceId === dependency);
            expect(dependencyCompleted!.simTimeMs).toBeLessThanOrEqual(started!.simTimeMs);
          }
        }
      }
    },
  );

  it('never overlaps service in one room and calculates bounded virtual-time metrics', () => {
    const result = runBenchmarkScenario(generateBenchmarkScenario(base), 'SHORTEST_QUEUE');
    for (const room of result.rooms) {
      const roomEvents = result.events.filter((event) => event.roomId === room.roomId);
      let active = 0;
      for (const event of roomEvents) {
        if (event.type === 'SERVICE_STARTED') active += 1;
        if (event.type === 'SERVICE_COMPLETED') active -= 1;
        expect(active).toBeGreaterThanOrEqual(0);
        expect(active).toBeLessThanOrEqual(1);
      }
      expect(active).toBe(0);
    }
    expect(result.metrics.averageWaitingTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.p95WaitingTimeMs).toBeGreaterThanOrEqual(result.metrics.averageWaitingTimeMs);
    expect(result.metrics.maxWaitingTimeMs).toBeGreaterThanOrEqual(result.metrics.p95WaitingTimeMs);
    expect(result.metrics.averageLengthOfStayMs).toBeGreaterThan(0);
    expect(result.metrics.throughputPerSimHour).toBeGreaterThan(0);
    expect(result.metrics.averageRoomUtilizationPct).toBeGreaterThan(0);
    expect(result.metrics.averageRoomUtilizationPct).toBeLessThanOrEqual(100);
  });

  it('gives every algorithm a deep-equivalent scenario without mutation', () => {
    const scenario = generateBenchmarkScenario(base);
    const canonical = structuredClone(scenario);
    for (const algorithm of ['SYSTEM', 'SHORTEST_QUEUE', 'ROUND_ROBIN', 'RANDOM', 'LEAST_UTILISED'] as const) {
      runBenchmarkScenario(structuredClone(scenario), algorithm);
      expect(scenario).toEqual(canonical);
    }
  });
});
