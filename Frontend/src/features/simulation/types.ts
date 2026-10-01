// Khớp với Backend/src/modules/simulation/{metrics,orchestrator}/*.ts
// (Phase 4-6). Xem docs/simulator-architecture.md nếu cần đối chiếu ngược.
import type { components } from "@/generated/critical-staff-contract";

export type SimulationRunStatus =
  | "PENDING"
  | "PREPARING"
  | "RUNNING"
  | "PAUSED"
  | "DRAINING"
  | "COMPLETED"
  | "STOPPING"
  | "STOPPED"
  | "FAILED";

export type SimulationRunMode = "LOCKSTEP" | "CONCURRENT";
export type SimulationClockPolicy = "ASAP" | "PACED" | "STEP";
export type SimulationSpeed = 1 | 2 | 5 | 10 | 50;

export type SimulationArrival =
  | { kind: "FIXED"; intervalMs: number }
  | { kind: "BURST"; atMs?: number };

export interface SimulationRoomConfig {
  roomId: number;
  withDoctor?: boolean;
  withDevice?: boolean;
  useRoomTypeAvgProcessTime?: boolean;
  serviceTimeMeanSeconds: number;
  serviceTimeStdDevSeconds?: number;
}

export interface CreateSimulationRunPayload {
  name: string;
  seed: number;
  flowId: number;
  patientCount: number;
  arrival: SimulationArrival;
  noShowProbability?: number;
  rooms: SimulationRoomConfig[];
  mode?: SimulationRunMode;
  concurrencyLimit?: number;
  clockPolicy?: SimulationClockPolicy;
  speed?: SimulationSpeed;
  assertionSweepIntervalMs?: number;
  stuckThresholdMs?: number;
  routingMaxPendingMs?: number;
}

export interface QuantileSummary {
  count: number;
  mean: number;
  median: number;
  p95: number;
  max: number;
}

export interface RoomMetrics {
  waitingTimeMs: QuantileSummary;
  serviceTimeMs: QuantileSummary;
  utilisationPct: number;
  patientsServed: number;
}

export interface MetricsSnapshot {
  simTimeMs: number;
  counters: {
    patientsArrived: number;
    visitsCreated: number;
    visitsCompleted: number;
    noShows: number;
    stepsWaiting: number;
    stepsInService: number;
  };
  waitingTimeMs: QuantileSummary;
  lengthOfStayMs: QuantileSummary;
  serviceTimeMs: QuantileSummary;
  throughputPerSimHour: number;
  perRoom: Record<number, RoomMetrics>;
}

/** Bản ghi SimulationRun thô từ DB — trả về khi run KHÔNG (còn) chạy trong bộ nhớ orchestrator. */
export interface SimulationRunRecord {
  id: string;
  name: string;
  status: SimulationRunStatus;
  mode: SimulationRunMode;
  seed: number;
  config: CreateSimulationRunPayload;
  startedAt: string | null;
  finishedAt: string | null;
  simEndTimeMs: number | null;
  summary: MetricsSnapshot | null;
  createdAt: string;
  roomState?: SimulationRoomState[];
  patientLocations?: SimulationPatientLocation[];
}

/** Snapshot TRỰC TIẾP từ bộ nhớ orchestrator — trả về khi run đang chạy (mới hơn DB). */
export interface SimulationRunLiveSnapshot {
  id: string;
  status: SimulationRunStatus;
  simTimeMs: number;
  processedEventCount: number;
  pendingEventCount: number;
  metrics: MetricsSnapshot;
  config: CreateSimulationRunPayload;
  roomState?: SimulationRoomState[];
  patientLocations?: SimulationPatientLocation[];
}

export interface SimulationPatientLocation {
  patientId: string;
  patientName: string;
  visitId: string;
  visitStepId: number;
  stepDisplayOrder: number;
  currentStep: string;
  currentRoom: string | null;
  status: string;
}

export interface SimulationRoomState {
  roomId: number;
  roomNumber: string;
  name: string;
  roomType: string;
  roomStatus: string;
  avgProcessTimeSeconds: number;
  examiningCount: number;
  waitingCount: number;
  estimatedWaitingSeconds: number;
  currentPatient: {
    patientId: string;
    patientName: string;
    visitId: string;
    visitStepId: number;
    currentStep: string;
    status: string;
  } | null;
  queue: Array<{
    position: number;
    patientId: string;
    patientName: string;
    visitId: string;
    visitStepId: number;
    currentStep: string;
    status: string;
  }>;
}

export type SimulationRunDetail = SimulationRunRecord | SimulationRunLiveSnapshot;

/** true nếu response là snapshot trực tiếp (đang chạy), false nếu là bản ghi DB (đã kết thúc/chưa chạy). */
export function isLiveSnapshot(
  detail: SimulationRunDetail,
): detail is SimulationRunLiveSnapshot {
  return "metrics" in detail && "processedEventCount" in detail;
}

export interface SimulationViolation {
  id: string;
  runId: string;
  simTimeMs: number;
  rule: string;
  severity: "ERROR" | "WARNING";
  visitId: string | null;
  visitStepId: number | null;
  roomId: number | null;
  stateSnapshot: unknown;
  createdAt: string;
}

export interface OutcomeDiffField {
  field: string;
  lockstep: number;
  concurrent: number;
}

export interface CompareRunsResult {
  lockstepRunId: string;
  concurrentRunId: string;
  diff: { identical: boolean; differences: OutcomeDiffField[] };
}

/** Payload đẩy qua Socket.IO namespace /simulation, event 'snapshot' (xem simulation.gateway.ts). */
export interface SimulationSocketSnapshot extends SimulationRunLiveSnapshot {
  runId: string;
}

export interface SimulationSocketFinished {
  runId: string;
  status: SimulationRunStatus;
}

export type BenchmarkRunResult = components["schemas"]["BenchmarkRunEnvelopeDto"]["data"];
export type BenchmarkCompareResult = components["schemas"]["BenchmarkCompareEnvelopeDto"]["data"];
export type BenchmarkAlgorithm = BenchmarkRunResult["algorithm"];
export type BenchmarkWorkflow = BenchmarkRunResult["workflow"];

export interface BenchmarkRequest {
  patientCount: number;
  workflow: BenchmarkWorkflow;
  seed: number;
}

export type BenchmarkMetrics = BenchmarkRunResult["metrics"];
export type BenchmarkEvent = BenchmarkRunResult["events"][number];
