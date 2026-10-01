/**
 * Kiểm tra các bất biến A1-A12 (xem docs/simulator-architecture.md §11) trên
 * MỘT lát cắt trạng thái (snapshot) — hàm THUẦN, không tự đọc DB.
 *
 * A13 (so sánh LOCKSTEP vs CONCURRENT) KHÔNG nằm ở đây — nó cần 2 lần CHẠY
 * khác nhau để so sánh, không phải 1 phép quét trạng thái, và CONCURRENT
 * mode chưa tồn tại (Phase 5).
 *
 * A3 (step status không được đi lùi khỏi trạng thái kết thúc) là bất biến
 * DUY NHẤT thực sự cần LỊCH SỬ — giải quyết bằng cách để CALLER tự giữ và
 * truyền vào `previousStepStatuses` (kết quả `nextStepStatuses` của lần gọi
 * TRƯỚC), thay vì để hàm này tự giữ state nội bộ — giữ hàm thuần, dễ test
 * độc lập từng lần gọi mà không cần dựng chuỗi nhiều sweep.
 */

import {
  ACTIVE_ASSIGNMENT_STATUSES,
  ASSERTION_RULES,
  SimulationSweepInput,
  SimulationViolationInput,
  SweepVisitStep,
  TERMINAL_STEP_STATUSES,
} from './simulation-sweep.types';

export interface EvaluateAssertionsResult {
  violations: SimulationViolationInput[];
  /** Truyền vào làm `previousStepStatuses` cho lần sweep KẾ TIẾP của CÙNG 1 run, để A3 hoạt động. */
  nextStepStatuses: Map<number, string>;
}

const EXPECTED_ASSIGNMENT_STATUS_FOR_STEP: Partial<Record<SweepVisitStep['status'], string>> = {
  ASSIGNED: 'WAITING',
  CHECKED_IN: 'CHECKED_IN',
  IN_PROGRESS: 'IN_PROGRESS',
};
const PRE_ROUTING_STEP_STATUSES = new Set(['LOCKED', 'READY']);
const RESOLVED_DEPENDENCY_STEP_STATUSES = new Set<SweepVisitStep['status']>([
  'COMPLETED',
  'SKIPPED',
]);

export function evaluateSimulationAssertions(
  input: SimulationSweepInput,
  previousStepStatuses?: ReadonlyMap<number, string>,
): EvaluateAssertionsResult {
  const violations: SimulationViolationInput[] = [];
  const nextStepStatuses = new Map<number, string>();

  // Tra cứu nhanh: stepId -> status, dùng cho A9 (đối chiếu dependency CÙNG visit)
  const stepStatusById = new Map<number, string>();
  for (const visit of input.visits) {
    for (const step of visit.steps) stepStatusById.set(step.id, step.status);
  }

  for (const visit of input.visits) {
    // A1 — a patient may have at most one active service assignment at a time.
    const inProgressAssignments = visit.steps.flatMap((s) =>
      s.assignments.filter((a) => a.status === 'IN_PROGRESS').map((a) => ({ stepId: s.id, ...a })),
    );
    if (inProgressAssignments.length > 1) {
      violations.push({
        rule: ASSERTION_RULES.A1_NOT_IN_SERVICE_IN_TWO_ROOMS,
        severity: 'ERROR',
        visitId: visit.id,
        stateSnapshot: { inProgressAssignments },
      });
    }

    // A4 — Visit COMPLETED thì không được còn assignment nào đang active
    if (visit.status === 'COMPLETED') {
      const activeAssignments = visit.steps.flatMap((s) =>
        s.assignments
          .filter((a) => ACTIVE_ASSIGNMENT_STATUSES.has(a.status))
          .map((a) => ({ stepId: s.id, ...a })),
      );
      if (activeAssignments.length > 0) {
        violations.push({
          rule: ASSERTION_RULES.A4_COMPLETED_VISIT_HAS_ACTIVE_ASSIGNMENT,
          severity: 'ERROR',
          visitId: visit.id,
          stateSnapshot: { activeAssignments },
        });
      }
    }

    for (const step of visit.steps) {
      nextStepStatuses.set(step.id, step.status);

      // A3 — step đã ở trạng thái kết thúc thì không được đổi sang trạng thái khác nữa
      const previous = previousStepStatuses?.get(step.id);
      if (previous && TERMINAL_STEP_STATUSES.has(previous) && step.status !== previous) {
        violations.push({
          rule: ASSERTION_RULES.A3_STEP_STATUS_NOT_MONOTONIC,
          severity: 'ERROR',
          visitId: visit.id,
          visitStepId: step.id,
          stateSnapshot: { previousStatus: previous, currentStatus: step.status },
        });
      }

      // A8 — VisitStep.status và VisitAssignment.status (đang active) phải khớp bảng ánh xạ trong schema
      if (PRE_ROUTING_STEP_STATUSES.has(step.status) && step.assignments.length > 0) {
        violations.push({
          rule: ASSERTION_RULES.A8_STEP_ASSIGNMENT_OUT_OF_SYNC,
          severity: 'ERROR',
          visitId: visit.id,
          visitStepId: step.id,
          stateSnapshot: { stepStatus: step.status, assignments: step.assignments },
        });
      }
      const expectedAssignmentStatus = EXPECTED_ASSIGNMENT_STATUS_FOR_STEP[step.status];
      if (expectedAssignmentStatus) {
        const matching = step.assignments.filter((a) => a.status === expectedAssignmentStatus);
        if (matching.length === 0) {
          violations.push({
            rule: ASSERTION_RULES.A8_STEP_ASSIGNMENT_OUT_OF_SYNC,
            severity: 'ERROR',
            visitId: visit.id,
            visitStepId: step.id,
            stateSnapshot: {
              stepStatus: step.status,
              expectedAssignmentStatus,
              assignments: step.assignments,
            },
          });
        }
      }

      // A9 — cancellation is terminal for lifecycle purposes, but it does
      // not satisfy a clinical prerequisite. Only COMPLETED, or SKIPPED when
      // policy permits it, resolves a dependency.
      if (step.status === 'IN_PROGRESS' || step.status === 'COMPLETED') {
        const unresolvedDeps = step.dependsOnStepIds.filter((depId) => {
          const depStatus = stepStatusById.get(depId);
          return (
            !depStatus ||
            !RESOLVED_DEPENDENCY_STEP_STATUSES.has(
              depStatus as SweepVisitStep['status'],
            )
          );
        });
        if (unresolvedDeps.length > 0) {
          violations.push({
            rule: ASSERTION_RULES.A9_DEPENDENCY_NOT_SATISFIED,
            severity: 'ERROR',
            visitId: visit.id,
            visitStepId: step.id,
            stateSnapshot: { unresolvedDependencyStepIds: unresolvedDeps },
          });
        }
      }

      // A11 — step chưa kết thúc mà lâu rồi không đổi trạng thái -> nghi ngờ bị kẹt
      if (
        !['LOCKED', 'READY'].includes(step.status) &&
        !TERMINAL_STEP_STATUSES.has(step.status) &&
        input.nowMs - step.updatedAtMs > input.stuckThresholdMs
      ) {
        violations.push({
          rule: ASSERTION_RULES.A11_PATIENT_STUCK,
          severity: 'WARNING',
          visitId: visit.id,
          visitStepId: step.id,
          stateSnapshot: {
            stepStatus: step.status,
            stuckForMs: input.nowMs - step.updatedAtMs,
          },
        });
      }
    }
  }

  // A2 + A5 — cần nhìn toàn cục theo phòng, không theo từng visit
  const queueEntriesByStep = groupBy(input.queueEntries, (e) => e.visitStepId);
  for (const [visitStepId, entries] of queueEntriesByStep) {
    if (entries.length > 1) {
      violations.push({
        rule: ASSERTION_RULES.A2_NO_DUPLICATE_QUEUE_ENTRY,
        severity: 'ERROR',
        visitStepId,
        stateSnapshot: { entries },
      });
    }
  }
  const queueEntriesByPosition = groupBy(input.queueEntries, (e) => `${e.roomId}:${e.position}`);
  for (const entries of queueEntriesByPosition.values()) {
    if (entries.length > 1) {
      violations.push({
        rule: ASSERTION_RULES.A5_QUEUE_POSITION_NOT_UNIQUE,
        severity: 'ERROR',
        roomId: entries[0].roomId,
        stateSnapshot: { entries },
      });
    }
  }

  // A6 + A7 — theo RoomRuntime
  const allAssignments = input.visits.flatMap((v) =>
    v.steps.flatMap((s) => s.assignments.map((a) => ({ visitId: v.id, stepId: s.id, ...a }))),
  );
  const inProgressByRoom = groupBy(
    allAssignments.filter((a) => a.status === 'IN_PROGRESS'),
    (a) => a.roomId,
  );
  for (const [roomId, assignments] of inProgressByRoom) {
    if (assignments.length > 1) {
      violations.push({
        rule: ASSERTION_RULES.A6_ROOM_CAPACITY_EXCEEDED,
        severity: 'ERROR',
        roomId,
        stateSnapshot: { assignments },
      });
    }
  }
  const assignmentById = new Map(allAssignments.map((a) => [a.id, a]));
  for (const runtime of input.roomRuntimes) {
    if (runtime.currentVisitAssignmentId === null) continue;
    const assignment = assignmentById.get(runtime.currentVisitAssignmentId);
    if (assignment && (assignment.status === 'COMPLETED' || assignment.status === 'CANCELLED')) {
      violations.push({
        rule: ASSERTION_RULES.A7_ROOM_RUNTIME_STALE,
        severity: 'ERROR',
        roomId: runtime.roomId,
        stateSnapshot: {
          currentVisitAssignmentId: runtime.currentVisitAssignmentId,
          assignmentStatus: assignment.status,
        },
      });
    }
    // Nếu RoomRuntime trỏ vào 1 assignment thật sự đang IN_PROGRESS, nó PHẢI
    // khớp với chính assignment IN_PROGRESS của phòng đó (đã gom ở trên) —
    // lệch nghĩa là RoomRuntime trỏ sai chỗ dù assignment kia còn hợp lệ.
    const roomsInProgress = inProgressByRoom.get(runtime.roomId) ?? [];
    if (
      roomsInProgress.length === 1 &&
      roomsInProgress[0].id !== runtime.currentVisitAssignmentId
    ) {
      violations.push({
        rule: ASSERTION_RULES.A7_ROOM_RUNTIME_STALE,
        severity: 'ERROR',
        roomId: runtime.roomId,
        stateSnapshot: {
          currentVisitAssignmentId: runtime.currentVisitAssignmentId,
          actualInProgressAssignmentId: roomsInProgress[0].id,
        },
      });
    }
  }

  // A10 — quyết định routing không được chọn 1 phòng ngoài danh sách đủ điều kiện tại thời điểm đó
  for (const decision of input.routingDecisions) {
    if (decision.selectedRoomId === null) continue;
    if (!decision.eligibleRoomIds.includes(decision.selectedRoomId)) {
      violations.push({
        rule: ASSERTION_RULES.A10_INELIGIBLE_ROOM_SELECTED,
        severity: 'ERROR',
        visitStepId: decision.visitStepId,
        roomId: decision.selectedRoomId,
        stateSnapshot: { eligibleRoomIds: decision.eligibleRoomIds },
      });
    }
  }

  // A12 — RoutingQueue còn PENDING quá lâu, không ai xử lý
  for (const entry of input.routingQueueEntries) {
    const owningVisit = input.visits.find((visit) =>
      visit.steps.some((step) => step.id === entry.visitStepId),
    );
    const visitHasActiveAssignment = owningVisit?.steps.some((step) =>
      step.assignments.some((assignment) => ACTIVE_ASSIGNMENT_STATUSES.has(assignment.status)),
    );
    if (
      entry.status === 'PENDING' &&
      !visitHasActiveAssignment &&
      input.nowMs - entry.enqueueAtMs > input.routingMaxPendingMs
    ) {
      violations.push({
        rule: ASSERTION_RULES.A12_ORPHANED_ROUTING_ENTRY,
        severity: 'WARNING',
        visitStepId: entry.visitStepId,
        stateSnapshot: { pendingForMs: input.nowMs - entry.enqueueAtMs },
      });
    }
  }

  return { violations, nextStepStatuses };
}

function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}
