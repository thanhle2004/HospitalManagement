import { RoutingCandidate } from '../../routing/strategies/routing-strategy.interface';
import { SeededRng } from '../engine/rng';
import { createBenchmarkStrategy, BENCHMARK_ALGORITHM_LABELS } from './benchmark-strategy.factory';
import {
  BenchmarkAlgorithm,
  BenchmarkEvent,
  BenchmarkRunResult,
  BenchmarkScenario,
} from './benchmark.types';

type StepStatus = 'LOCKED' | 'READY' | 'QUEUED' | 'IN_SERVICE' | 'COMPLETED';
interface StepState { status: StepStatus; readyAtMs: number; startedAtMs?: number; }
interface PatientState { completedAtMs?: number; steps: Map<string, StepState>; }
interface QueueItem { patientId: string; serviceId: string; readyAtMs: number; sequence: number; }
interface RoomState {
  id: string; serviceId: string; sortOrder: number; queue: QueueItem[];
  active?: QueueItem & { endsAtMs: number }; busyTimeMs: number; patientsServed: number;
}

function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
}

export function runBenchmarkScenario(
  scenario: BenchmarkScenario,
  algorithm: BenchmarkAlgorithm,
): BenchmarkRunResult {
  const strategy = createBenchmarkStrategy(algorithm);
  const rng = new SeededRng(scenario.seed);
  const patients = new Map<string, PatientState>();
  const rooms = scenario.rooms.map<RoomState>((room) => ({ ...room, queue: [], busyTimeMs: 0, patientsServed: 0 }));
  const events: BenchmarkEvent[] = [];
  const waits: number[] = [];
  const lengthsOfStay: number[] = [];
  let now = 0;
  let sequence = 0;
  let numericStepId = 1;

  const emit = (event: BenchmarkEvent) => { if (events.length < 2_000) events.push(event); };
  const patientById = new Map(scenario.patients.map((patient) => [patient.id, patient]));

  const unlock = (patientId: string) => {
    const state = patients.get(patientId)!;
    for (const definition of scenario.steps) {
      const step = state.steps.get(definition.id)!;
      if (step.status !== 'LOCKED') continue;
      if (definition.dependencies.every((dependency) => state.steps.get(dependency)?.status === 'COMPLETED')) {
        step.status = 'READY'; step.readyAtMs = now;
        emit({ simTimeMs: now, type: 'STEP_READY', patientId, serviceId: definition.id });
      }
    }
  };

  const routeReady = () => {
    for (const patient of scenario.patients) {
      const state = patients.get(patient.id);
      if (!state) continue;
      for (let displayOrder = 0; displayOrder < scenario.steps.length; displayOrder += 1) {
        const definition = scenario.steps[displayOrder];
        const step = state.steps.get(definition.id)!;
        if (step.status !== 'READY') continue;
        const eligible = rooms.filter((room) => room.serviceId === definition.id);
        const visitStepId = numericStepId++;
        const candidates: RoutingCandidate[] = eligible.map((room) => {
          const waitingCount = room.queue.length;
          const inServiceCount = room.active ? 1 : 0;
          const averageSeconds = 90;
          return {
            visitStepId,
            visitStepDisplayOrder: displayOrder + 1,
            room: { id: room.sortOrder, roomNumber: room.id, sortOrder: room.sortOrder },
            inServiceCount,
            waitingCount,
            effectiveAverageProcessTimeSeconds: averageSeconds,
            estimatedWaitingSeconds: (inServiceCount + waitingCount) * averageSeconds,
          };
        });
        const decision = strategy.select(candidates, {
          random: () => rng.float(`routing:${algorithm}`),
        });
        const selected = eligible.find((room) => room.sortOrder === decision.selectedRoomId)!;
        selected.queue.push({ patientId: patient.id, serviceId: definition.id, readyAtMs: step.readyAtMs, sequence: sequence++ });
        step.status = 'QUEUED';
        emit({ simTimeMs: now, type: 'QUEUED', patientId: patient.id, serviceId: definition.id, roomId: selected.id });
      }
    }
  };

  const startIdleRooms = () => {
    for (const room of rooms) {
      if (room.active || room.queue.length === 0) continue;
      room.queue.sort((a, b) => a.readyAtMs - b.readyAtMs || a.sequence - b.sequence);
      const item = room.queue.shift()!;
      const step = patients.get(item.patientId)!.steps.get(item.serviceId)!;
      step.status = 'IN_SERVICE'; step.startedAtMs = now;
      waits.push(now - item.readyAtMs);
      const duration = patientById.get(item.patientId)!.serviceDurationsMs[item.serviceId];
      room.active = { ...item, endsAtMs: now + duration };
      emit({ simTimeMs: now, type: 'SERVICE_STARTED', patientId: item.patientId, serviceId: item.serviceId, roomId: room.id });
    }
  };

  while (lengthsOfStay.length < scenario.patients.length) {
    const nextArrival = scenario.patients.find((patient) => !patients.has(patient.id))?.arrivalTimeMs;
    const nextCompletion = rooms.reduce<number | undefined>(
      (min, room) => room.active && (min === undefined || room.active.endsAtMs < min) ? room.active.endsAtMs : min,
      undefined,
    );
    const candidates = [nextArrival, nextCompletion].filter((value): value is number => value !== undefined);
    if (candidates.length === 0) throw new Error('Benchmark deadlock: no pending arrival or service completion');
    now = Math.min(...candidates);

    for (const room of rooms) {
      if (!room.active || room.active.endsAtMs !== now) continue;
      const completed = room.active;
      room.active = undefined; room.busyTimeMs += now - (patients.get(completed.patientId)!.steps.get(completed.serviceId)!.startedAtMs ?? now);
      room.patientsServed += 1;
      patients.get(completed.patientId)!.steps.get(completed.serviceId)!.status = 'COMPLETED';
      emit({ simTimeMs: now, type: 'SERVICE_COMPLETED', patientId: completed.patientId, serviceId: completed.serviceId, roomId: room.id });
      unlock(completed.patientId);
      const patientState = patients.get(completed.patientId)!;
      if ([...patientState.steps.values()].every((step) => step.status === 'COMPLETED')) {
        patientState.completedAtMs = now;
        lengthsOfStay.push(now - patientById.get(completed.patientId)!.arrivalTimeMs);
        emit({ simTimeMs: now, type: 'PATIENT_COMPLETED', patientId: completed.patientId });
      }
    }

    for (const patient of scenario.patients.filter((item) => item.arrivalTimeMs === now)) {
      patients.set(patient.id, {
        steps: new Map(scenario.steps.map((step) => [step.id, { status: 'LOCKED' as const, readyAtMs: now }])),
      });
      emit({ simTimeMs: now, type: 'ARRIVED', patientId: patient.id });
      unlock(patient.id);
    }
    routeReady();
    startIdleRooms();
  }

  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const roomResults = rooms.map((room) => ({
    roomId: room.id,
    serviceId: room.serviceId,
    patientsServed: room.patientsServed,
    busyTimeMs: room.busyTimeMs,
    utilizationPct: now > 0 ? (room.busyTimeMs / now) * 100 : 0,
  }));
  return {
    algorithm,
    algorithmLabel: BENCHMARK_ALGORITHM_LABELS[algorithm],
    seed: scenario.seed,
    workflow: scenario.workflow,
    patientCount: scenario.patients.length,
    simulationTimeMs: now,
    metrics: {
      averageWaitingTimeMs: waits.length ? sum(waits) / waits.length : 0,
      p95WaitingTimeMs: percentile95(waits),
      maxWaitingTimeMs: waits.length ? Math.max(...waits) : 0,
      averageLengthOfStayMs: lengthsOfStay.length ? sum(lengthsOfStay) / lengthsOfStay.length : 0,
      throughputPerSimHour: now > 0 ? scenario.patients.length / (now / 3_600_000) : 0,
      averageRoomUtilizationPct: roomResults.length ? sum(roomResults.map((room) => room.utilizationPct)) / roomResults.length : 0,
      completedPatientCount: lengthsOfStay.length,
    },
    rooms: roomResults,
    events,
  };
}
