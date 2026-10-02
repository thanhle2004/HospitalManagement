import { MinEstimatedWaitingTimeStrategy } from '../../routing/strategies/min-estimated-waiting-time.strategy';
import { RoundRobinStrategy } from '../../routing/strategies/round-robin.strategy';
import { RoutingCandidate } from '../../routing/strategies/routing-strategy.interface';
import { generateBenchmarkScenario } from './benchmark-scenario.generator';
import { createBenchmarkStrategy } from './benchmark-strategy.factory';
import { runBenchmarkScenario } from './benchmark-runner';
import { BenchmarkConfig, BenchmarkScenario, WorkflowDependencyType } from './benchmark.types';

const base: BenchmarkConfig = { patientCount: 8, workflow: 'SEQUENTIAL', seed: 42, processingProfile: 'HETEROGENEOUS' };

function candidate(roomId: number, sortOrder: number, load: number, expectedSeconds: number, visitStepId: number): RoutingCandidate {
  return { visitStepId, visitStepDisplayOrder: visitStepId, room: { id: roomId, roomNumber: `ROOM_${roomId}`, sortOrder }, inServiceCount: 0, waitingCount: load, effectiveAverageProcessTimeSeconds: expectedSeconds, estimatedWaitingSeconds: load * expectedSeconds };
}

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
    expect(first.scenarioId).toMatch(/^SCN-[A-F0-9]{12}$/);
  });

  it('models homogeneous and heterogeneous service characteristics without room heterogeneity', () => {
    const heterogeneous = generateBenchmarkScenario(base);
    expect(new Set(heterogeneous.steps.map((step) => step.expectedAverageProcessTimeSeconds)).size).toBeGreaterThan(1);
    for (const step of heterogeneous.steps) {
      expect(heterogeneous.rooms.filter((room) => room.serviceId === step.id).map((room) => room.expectedAverageProcessTimeSeconds)).toEqual([step.expectedAverageProcessTimeSeconds, step.expectedAverageProcessTimeSeconds]);
    }
    const homogeneous = generateBenchmarkScenario({ ...base, processingProfile: 'HOMOGENEOUS' });
    expect(new Set(homogeneous.steps.map((step) => step.expectedAverageProcessTimeSeconds))).toEqual(new Set([300]));
  });

  it('materializes deterministic actual duration from patient/service characteristics within the documented range', () => {
    const scenario = generateBenchmarkScenario(base);
    for (const patient of scenario.patients) for (const step of scenario.steps) {
      const actualSeconds = patient.serviceDurationsMs[step.id] / 1000;
      expect(actualSeconds).toBeGreaterThanOrEqual(step.expectedAverageProcessTimeSeconds * 0.8);
      expect(actualSeconds).toBeLessThanOrEqual(step.expectedAverageProcessTimeSeconds * 1.2);
    }
    expect(generateBenchmarkScenario(base).patients).toEqual(scenario.patients);
  });

  it('resolves SYSTEM directly to the production strategy implementation', () => {
    expect(createBenchmarkStrategy('SYSTEM')).toBeInstanceOf(MinEstimatedWaitingTimeStrategy);
  });

  it('creates fresh instances for stateful strategies', () => {
    expect(createBenchmarkStrategy('ROUND_ROBIN')).not.toBe(createBenchmarkStrategy('ROUND_ROBIN'));
    expect(createBenchmarkStrategy('LEAST_UTILISED')).not.toBe(createBenchmarkStrategy('LEAST_UTILISED'));
  });

  it('keeps SYSTEM and SHORTEST_QUEUE equivalent in the homogeneous control', () => {
    for (const workflow of ['INDEPENDENT', 'SEQUENTIAL', 'PARTIAL'] as const) {
      const scenario = generateBenchmarkScenario({ ...base, workflow, processingProfile: 'HOMOGENEOUS' });
      expect(runBenchmarkScenario(scenario, 'SYSTEM').metrics).toEqual(runBenchmarkScenario(scenario, 'SHORTEST_QUEUE').metrics);
    }
  });

  it('has a deterministic heterogeneous counterexample where objectives select different services', () => {
    const candidates = [candidate(1, 1, 2, 300, 1), candidate(2, 2, 1, 900, 2)];
    expect(createBenchmarkStrategy('SYSTEM').select(candidates).selectedRoomId).toBe(1);
    expect(createBenchmarkStrategy('SHORTEST_QUEUE').select(candidates).selectedRoomId).toBe(2);
  });

  it('reproduces the transient-step reset and verifies stable benchmark identity rotates 1→2→1→2', () => {
    const broken = new RoundRobinStrategy();
    const brokenPicks = [1, 2, 3, 4].map((step) => broken.select([candidate(1, 1, 0, 300, step), candidate(2, 2, 0, 300, step)]).selectedRoomId);
    expect(brokenPicks).toEqual([1, 1, 1, 1]);
    const corrected = new RoundRobinStrategy();
    const stable = [1, 2, 3, 4].map(() => corrected.select([candidate(1, 1, 0, 300, 1), candidate(2, 2, 0, 300, 1)]).selectedRoomId);
    expect(stable).toEqual([1, 2, 1, 2]);
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

  it('calculates step waits, patient LOS, finite-run throughput, and time-weighted utilization exactly', () => {
    const scenario: BenchmarkScenario = {
      schemaVersion: 1, scenarioId: 'SCN-METRICS', seed: 1, workflow: 'SEQUENTIAL', processingProfile: 'HOMOGENEOUS',
      steps: [{ id: 'SERVICE_A', dependencies: [], expectedAverageProcessTimeSeconds: 100, rooms: ['ROOM_A_1', 'ROOM_A_2'] }],
      rooms: [
        { id: 'ROOM_A_1', serviceId: 'SERVICE_A', sortOrder: 1, expectedAverageProcessTimeSeconds: 100 },
        { id: 'ROOM_A_2', serviceId: 'SERVICE_A', sortOrder: 2, expectedAverageProcessTimeSeconds: 100 },
      ],
      patients: [1, 2, 3].map((n) => ({ id: `P00${n}`, arrivalTimeMs: 0, serviceDurationsMs: { SERVICE_A: 100_000 } })),
    };
    const metrics = runBenchmarkScenario(scenario, 'SHORTEST_QUEUE').metrics;
    expect(metrics.averageWaitingTimeMs).toBeCloseTo(100_000 / 3);
    expect(metrics.p95WaitingTimeMs).toBe(100_000);
    expect(metrics.maxWaitingTimeMs).toBe(100_000);
    expect(metrics.averageLengthOfStayMs).toBeCloseTo(400_000 / 3);
    expect(metrics.throughputPerSimHour).toBe(54);
    expect(metrics.averageRoomUtilizationPct).toBe(75);
  });
});
