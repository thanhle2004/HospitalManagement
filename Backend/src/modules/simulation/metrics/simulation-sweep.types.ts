/**
 * Hình dạng dữ liệu tối thiểu 1 lần "quét" (sweep) cần để kiểm tra các bất
 * biến A1-A12 (xem docs/simulator-architecture.md §11). Cố tình KHÔNG dùng
 * type của Prisma trực tiếp — evaluateSimulationAssertions() (cùng thư mục)
 * là hàm THUẦN, không đụng DB, nên input của nó phải là dữ liệu thuần.
 * Việc TRUY VẤN DB để lắp ra input này là trách nhiệm của 1 lớp khác
 * (SimulationAssertionsRunner — DB-touching, không unit-test được trong môi
 * trường hiện tại vì @prisma/client chưa generate được, xem README trong
 * PR này), KHÔNG phải của file này.
 */

export interface SweepVisitAssignment {
  id: number;
  roomId: number;
  status: 'WAITING' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface SweepVisitStep {
  id: number;
  status:
    | 'LOCKED'
    | 'READY'
    | 'ASSIGNED'
    | 'CHECKED_IN'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'SKIPPED'
    | 'CANCELLED';
  updatedAtMs: number;
  /** id của các VisitStep mà step này phụ thuộc (VisitStepDependency.requiredStepId), CÙNG visit. */
  dependsOnStepIds: number[];
  assignments: SweepVisitAssignment[];
}

export interface SweepVisit {
  id: string;
  status: 'CREATED' | 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  steps: SweepVisitStep[];
}

export interface SweepRoomRuntime {
  roomId: number;
  currentVisitAssignmentId: number | null;
}

export interface SweepRoomQueueEntry {
  roomId: number;
  position: number;
  visitAssignmentId: number;
  visitStepId: number;
}

export interface SweepRoutingQueueEntry {
  visitStepId: number;
  status: 'PENDING' | 'PROCESSING' | 'FAILED';
  enqueueAtMs: number;
}

export interface SweepRoutingDecision {
  visitStepId: number;
  selectedRoomId: number | null;
  /** roomId của mọi candidate ĐỦ ĐIỀU KIỆN tại thời điểm ra quyết định (từ RoutingDecision.candidates). */
  eligibleRoomIds: number[];
}

export interface SimulationSweepInput {
  nowMs: number;
  visits: SweepVisit[];
  roomRuntimes: SweepRoomRuntime[];
  queueEntries: SweepRoomQueueEntry[];
  routingQueueEntries: SweepRoutingQueueEntry[];
  routingDecisions: SweepRoutingDecision[];
  /** VisitStep chưa ở trạng thái kết thúc, không đổi status quá lâu -> coi là "stuck" (A11). Mặc định gợi ý: 5 phút SIM-TIME. */
  stuckThresholdMs: number;
  /** RoutingQueue còn PENDING quá lâu -> coi là "mồ côi" (A12). Mặc định gợi ý: 60 giây SIM-TIME. */
  routingMaxPendingMs: number;
}

export type ViolationSeverity = 'ERROR' | 'WARNING';

export interface SimulationViolationInput {
  rule: string;
  severity: ViolationSeverity;
  visitId?: string;
  visitStepId?: number;
  roomId?: number;
  stateSnapshot: Record<string, unknown>;
}

export const TERMINAL_STEP_STATUSES = new Set(['COMPLETED', 'SKIPPED', 'CANCELLED']);
export const ACTIVE_ASSIGNMENT_STATUSES = new Set(['WAITING', 'CHECKED_IN', 'IN_PROGRESS']);

export const ASSERTION_RULES = {
  A1_NOT_IN_SERVICE_IN_TWO_ROOMS: 'A1_NOT_IN_SERVICE_IN_TWO_ROOMS',
  A2_NO_DUPLICATE_QUEUE_ENTRY: 'A2_NO_DUPLICATE_QUEUE_ENTRY',
  A3_STEP_STATUS_NOT_MONOTONIC: 'A3_STEP_STATUS_NOT_MONOTONIC',
  A4_COMPLETED_VISIT_HAS_ACTIVE_ASSIGNMENT: 'A4_COMPLETED_VISIT_HAS_ACTIVE_ASSIGNMENT',
  A5_QUEUE_POSITION_NOT_UNIQUE: 'A5_QUEUE_POSITION_NOT_UNIQUE',
  A6_ROOM_CAPACITY_EXCEEDED: 'A6_ROOM_CAPACITY_EXCEEDED',
  A7_ROOM_RUNTIME_STALE: 'A7_ROOM_RUNTIME_STALE',
  A8_STEP_ASSIGNMENT_OUT_OF_SYNC: 'A8_STEP_ASSIGNMENT_OUT_OF_SYNC',
  A9_DEPENDENCY_NOT_SATISFIED: 'A9_DEPENDENCY_NOT_SATISFIED',
  A10_INELIGIBLE_ROOM_SELECTED: 'A10_INELIGIBLE_ROOM_SELECTED',
  A11_PATIENT_STUCK: 'A11_PATIENT_STUCK',
  A12_ORPHANED_ROUTING_ENTRY: 'A12_ORPHANED_ROUTING_ENTRY',
} as const;