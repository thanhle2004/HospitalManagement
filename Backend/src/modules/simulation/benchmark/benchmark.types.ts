export type BenchmarkAlgorithm =
  | 'SYSTEM'
  | 'SHORTEST_QUEUE'
  | 'ROUND_ROBIN'
  | 'RANDOM'
  | 'LEAST_UTILISED';

export type WorkflowDependencyType = 'INDEPENDENT' | 'SEQUENTIAL' | 'PARTIAL';

export interface BenchmarkConfig {
  patientCount: number;
  workflow: WorkflowDependencyType;
  seed: number;
}

export interface BenchmarkStepDefinition {
  id: string;
  dependencies: string[];
}

export interface BenchmarkPatient {
  id: string;
  arrivalTimeMs: number;
  serviceDurationsMs: Record<string, number>;
}

export interface BenchmarkRoomDefinition {
  id: string;
  serviceId: string;
  sortOrder: number;
}

export interface BenchmarkScenario {
  schemaVersion: 1;
  seed: number;
  workflow: WorkflowDependencyType;
  steps: BenchmarkStepDefinition[];
  rooms: BenchmarkRoomDefinition[];
  patients: BenchmarkPatient[];
}

export interface BenchmarkMetrics {
  averageWaitingTimeMs: number;
  p95WaitingTimeMs: number;
  maxWaitingTimeMs: number;
  averageLengthOfStayMs: number;
  throughputPerSimHour: number;
  averageRoomUtilizationPct: number;
  completedPatientCount: number;
}

export interface BenchmarkEvent {
  simTimeMs: number;
  type: 'ARRIVED' | 'STEP_READY' | 'QUEUED' | 'SERVICE_STARTED' | 'SERVICE_COMPLETED' | 'PATIENT_COMPLETED';
  patientId: string;
  serviceId?: string;
  roomId?: string;
}

export interface BenchmarkRoomResult {
  roomId: string;
  serviceId: string;
  patientsServed: number;
  busyTimeMs: number;
  utilizationPct: number;
}

export interface BenchmarkRunResult {
  algorithm: BenchmarkAlgorithm;
  algorithmLabel: string;
  seed: number;
  workflow: WorkflowDependencyType;
  patientCount: number;
  simulationTimeMs: number;
  metrics: BenchmarkMetrics;
  rooms: BenchmarkRoomResult[];
  events: BenchmarkEvent[];
}
