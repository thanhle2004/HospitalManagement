export type BenchmarkAlgorithm =
  | 'SYSTEM'
  | 'SHORTEST_QUEUE'
  | 'ROUND_ROBIN'
  | 'RANDOM'
  | 'LEAST_UTILISED';

export type WorkflowDependencyType = 'INDEPENDENT' | 'SEQUENTIAL' | 'PARTIAL';
export type ProcessingProfile = 'HOMOGENEOUS' | 'HETEROGENEOUS';

export interface BenchmarkConfig {
  patientCount: number;
  workflow: WorkflowDependencyType;
  seed: number;
  processingProfile: ProcessingProfile;
}

export interface BenchmarkStepDefinition {
  id: string;
  dependencies: string[];
  expectedAverageProcessTimeSeconds: number;
  rooms: string[];
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
  expectedAverageProcessTimeSeconds: number;
}

export interface BenchmarkScenario {
  schemaVersion: 1;
  scenarioId: string;
  seed: number;
  workflow: WorkflowDependencyType;
  processingProfile: ProcessingProfile;
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
  processingProfile: ProcessingProfile;
  scenarioId: string;
  services: BenchmarkStepDefinition[];
  patientCount: number;
  simulationTimeMs: number;
  metrics: BenchmarkMetrics;
  rooms: BenchmarkRoomResult[];
  events: BenchmarkEvent[];
}
