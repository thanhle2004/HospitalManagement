import { evaluateSimulationAssertions } from './simulation-assertions';
import {
  ASSERTION_RULES,
  SimulationSweepInput,
  SweepVisit,
  SweepVisitAssignment,
  SweepVisitStep,
} from './simulation-sweep.types';

function assignment(
  id: number,
  roomId: number,
  status: SweepVisitAssignment['status'],
): SweepVisitAssignment {
  return { id, roomId, status };
}

function step(
  id: number,
  status: SweepVisitStep['status'],
  opts: Partial<Omit<SweepVisitStep, 'id' | 'status'>> = {},
): SweepVisitStep {
  return {
    id,
    status,
    updatedAtMs: 0,
    dependsOnStepIds: [],
    assignments: [],
    ...opts,
  };
}

function visit(
  id: string,
  status: SweepVisit['status'],
  steps: SweepVisitStep[],
): SweepVisit {
  return { id, status, steps };
}

function baseInput(overrides: Partial<SimulationSweepInput> = {}): SimulationSweepInput {
  return {
    nowMs: 0,
    visits: [],
    roomRuntimes: [],
    queueEntries: [],
    routingQueueEntries: [],
    routingDecisions: [],
    stuckThresholdMs: 300_000,
    routingMaxPendingMs: 60_000,
    ...overrides,
  };
}

function rulesOf(violations: { rule: string }[]): string[] {
  return violations.map((v) => v.rule);
}

describe('evaluateSimulationAssertions', () => {
  it('reports no violations for a perfectly healthy snapshot', () => {
    const input = baseInput({
      nowMs: 1_000,
      visits: [
        visit('v1', 'IN_PROGRESS', [
          step(1, 'IN_PROGRESS', {
            updatedAtMs: 900,
            assignments: [assignment(100, 4, 'IN_PROGRESS')],
          }),
        ]),
      ],
      roomRuntimes: [{ roomId: 4, currentVisitAssignmentId: 100 }],
      queueEntries: [{ roomId: 4, position: 1, visitAssignmentId: 100, visitStepId: 1 }],
    });

    const { violations } = evaluateSimulationAssertions(input);
    expect(violations).toEqual([]);
  });

  describe('A1 — not in service in two rooms at once', () => {
    it('flags a visit with multiple simultaneously IN_PROGRESS assignments', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'IN_PROGRESS', [
            step(1, 'IN_PROGRESS', { assignments: [assignment(100, 4, 'IN_PROGRESS')] }),
            step(2, 'IN_PROGRESS', { assignments: [assignment(101, 5, 'IN_PROGRESS')] }),
          ]),
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A1_NOT_IN_SERVICE_IN_TWO_ROOMS);
    });

    it('flags duplicate assignments for the same step', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'IN_PROGRESS', [
            step(1, 'IN_PROGRESS', {
              assignments: [assignment(100, 4, 'IN_PROGRESS'), assignment(101, 5, 'IN_PROGRESS')],
            }),
          ]),
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A1_NOT_IN_SERVICE_IN_TWO_ROOMS);
    });

    it('does NOT flag 2 parallel steps that are merely ASSIGNED (not IN_PROGRESS) — legal for a DAG fan-out', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'WAITING', [
            step(1, 'ASSIGNED', { assignments: [assignment(100, 4, 'WAITING')] }),
            step(2, 'ASSIGNED', { assignments: [assignment(101, 5, 'WAITING')] }),
          ]),
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A1_NOT_IN_SERVICE_IN_TWO_ROOMS);
    });
  });

  describe('A2 — no duplicate queue entry for the same step', () => {
    it('flags 2 queue entries pointing at the same visitStepId', () => {
      const input = baseInput({
        queueEntries: [
          { roomId: 4, position: 1, visitAssignmentId: 100, visitStepId: 1 },
          { roomId: 4, position: 2, visitAssignmentId: 101, visitStepId: 1 },
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A2_NO_DUPLICATE_QUEUE_ENTRY);
    });
  });

  describe('A3 — step status must not move after reaching a terminal status', () => {
    it('flags a step that regresses out of COMPLETED between 2 sweeps', () => {
      const input = baseInput({
        visits: [visit('v1', 'IN_PROGRESS', [step(1, 'IN_PROGRESS')])],
      });
      const previous = new Map([[1, 'COMPLETED']]);
      const { violations } = evaluateSimulationAssertions(input, previous);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A3_STEP_STATUS_NOT_MONOTONIC);
    });

    it('does not flag a step still at the same terminal status as last sweep', () => {
      const input = baseInput({ visits: [visit('v1', 'COMPLETED', [step(1, 'COMPLETED')])] });
      const previous = new Map([[1, 'COMPLETED']]);
      const { violations } = evaluateSimulationAssertions(input, previous);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A3_STEP_STATUS_NOT_MONOTONIC);
    });

    it('does not flag ordinary forward progress (READY -> ASSIGNED)', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'WAITING', [
            step(1, 'ASSIGNED', { assignments: [assignment(1, 4, 'WAITING')] }),
          ]),
        ],
      });
      const previous = new Map([[1, 'READY']]);
      const { violations } = evaluateSimulationAssertions(input, previous);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A3_STEP_STATUS_NOT_MONOTONIC);
    });

    it('returns nextStepStatuses that can be fed into the following sweep', () => {
      const input = baseInput({ visits: [visit('v1', 'COMPLETED', [step(1, 'COMPLETED')])] });
      const { nextStepStatuses } = evaluateSimulationAssertions(input);
      expect(nextStepStatuses.get(1)).toBe('COMPLETED');
    });

    it('is silent on the very first sweep (no previous snapshot to compare against)', () => {
      const input = baseInput({ visits: [visit('v1', 'CANCELLED', [step(1, 'CANCELLED')])] });
      const { violations } = evaluateSimulationAssertions(input, undefined);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A3_STEP_STATUS_NOT_MONOTONIC);
    });
  });

  describe('A4 — a COMPLETED visit must have no active assignments', () => {
    it('flags a COMPLETED visit with a lingering CHECKED_IN assignment', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'COMPLETED', [
            step(1, 'COMPLETED', { assignments: [assignment(100, 4, 'COMPLETED')] }),
            step(2, 'CHECKED_IN', { assignments: [assignment(101, 5, 'CHECKED_IN')] }),
          ]),
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(
        ASSERTION_RULES.A4_COMPLETED_VISIT_HAS_ACTIVE_ASSIGNMENT,
      );
    });

    it('does not flag a COMPLETED visit whose every assignment is also terminal', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'COMPLETED', [
            step(1, 'COMPLETED', { assignments: [assignment(100, 4, 'COMPLETED')] }),
          ]),
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(
        ASSERTION_RULES.A4_COMPLETED_VISIT_HAS_ACTIVE_ASSIGNMENT,
      );
    });
  });

  describe('A5 — queue position must be unique per room', () => {
    it('flags 2 entries at the same (roomId, position)', () => {
      const input = baseInput({
        queueEntries: [
          { roomId: 4, position: 1, visitAssignmentId: 100, visitStepId: 1 },
          { roomId: 4, position: 1, visitAssignmentId: 101, visitStepId: 2 },
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A5_QUEUE_POSITION_NOT_UNIQUE);
    });

    it('does not flag the same position number in 2 DIFFERENT rooms', () => {
      const input = baseInput({
        queueEntries: [
          { roomId: 4, position: 1, visitAssignmentId: 100, visitStepId: 1 },
          { roomId: 5, position: 1, visitAssignmentId: 101, visitStepId: 2 },
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A5_QUEUE_POSITION_NOT_UNIQUE);
    });
  });

  describe('A6 — room capacity (1) respected', () => {
    it('flags 2 different visits both IN_PROGRESS in the same room', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'IN_PROGRESS', [
            step(1, 'IN_PROGRESS', { assignments: [assignment(100, 4, 'IN_PROGRESS')] }),
          ]),
          visit('v2', 'IN_PROGRESS', [
            step(2, 'IN_PROGRESS', { assignments: [assignment(101, 4, 'IN_PROGRESS')] }),
          ]),
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A6_ROOM_CAPACITY_EXCEEDED);
    });
  });

  describe('A7 — RoomRuntime must not point at a stale assignment', () => {
    it('flags RoomRuntime pointing at a COMPLETED assignment (the §2.3 bug this exists to catch)', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'COMPLETED', [
            step(1, 'COMPLETED', { assignments: [assignment(100, 4, 'COMPLETED')] }),
          ]),
        ],
        roomRuntimes: [{ roomId: 4, currentVisitAssignmentId: 100 }],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A7_ROOM_RUNTIME_STALE);
    });

    it('does not flag a null RoomRuntime (room legitimately idle)', () => {
      const input = baseInput({ roomRuntimes: [{ roomId: 4, currentVisitAssignmentId: null }] });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A7_ROOM_RUNTIME_STALE);
    });

    it('flags RoomRuntime pointing at the wrong assignment while a different one is genuinely IN_PROGRESS in that room', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'IN_PROGRESS', [
            step(1, 'IN_PROGRESS', { assignments: [assignment(100, 4, 'IN_PROGRESS')] }),
          ]),
        ],
        roomRuntimes: [{ roomId: 4, currentVisitAssignmentId: 999 }],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A7_ROOM_RUNTIME_STALE);
    });

    it('does not flag RoomRuntime correctly pointing at the genuinely IN_PROGRESS assignment', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'IN_PROGRESS', [
            step(1, 'IN_PROGRESS', { assignments: [assignment(100, 4, 'IN_PROGRESS')] }),
          ]),
        ],
        roomRuntimes: [{ roomId: 4, currentVisitAssignmentId: 100 }],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A7_ROOM_RUNTIME_STALE);
    });
  });

  describe('A8 — VisitStep and VisitAssignment status must agree', () => {
    it('flags a LOCKED step that somehow already has an assignment', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'WAITING', [
            step(1, 'LOCKED', { assignments: [assignment(100, 4, 'WAITING')] }),
          ]),
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A8_STEP_ASSIGNMENT_OUT_OF_SYNC);
    });

    it('flags an ASSIGNED step with no WAITING assignment backing it', () => {
      const input = baseInput({
        visits: [visit('v1', 'WAITING', [step(1, 'ASSIGNED', { assignments: [] })])],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A8_STEP_ASSIGNMENT_OUT_OF_SYNC);
    });

    it('flags an IN_PROGRESS step whose only assignment is still CHECKED_IN (stuck mid-transition)', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'IN_PROGRESS', [
            step(1, 'IN_PROGRESS', { assignments: [assignment(100, 4, 'CHECKED_IN')] }),
          ]),
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A8_STEP_ASSIGNMENT_OUT_OF_SYNC);
    });

    it('does not flag a READY step with no assignment yet (expected — not yet routed)', () => {
      const input = baseInput({ visits: [visit('v1', 'WAITING', [step(1, 'READY')])] });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A8_STEP_ASSIGNMENT_OUT_OF_SYNC);
    });
  });

  describe('A9 — dependencies must be resolved before a step is serviced', () => {
    it('flags an IN_PROGRESS step whose dependency is still READY', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'IN_PROGRESS', [
            step(1, 'READY'),
            step(2, 'IN_PROGRESS', {
              dependsOnStepIds: [1],
              assignments: [assignment(100, 4, 'IN_PROGRESS')],
            }),
          ]),
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A9_DEPENDENCY_NOT_SATISFIED);
    });

    it('does not flag when every dependency is COMPLETED', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'IN_PROGRESS', [
            step(1, 'COMPLETED', { assignments: [assignment(99, 3, 'COMPLETED')] }),
            step(2, 'IN_PROGRESS', {
              dependsOnStepIds: [1],
              assignments: [assignment(100, 4, 'IN_PROGRESS')],
            }),
          ]),
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A9_DEPENDENCY_NOT_SATISFIED);
    });

    it('treats SKIPPED as a resolved dependency, not just COMPLETED', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'IN_PROGRESS', [
            step(1, 'SKIPPED'),
            step(2, 'IN_PROGRESS', {
              dependsOnStepIds: [1],
              assignments: [assignment(100, 4, 'IN_PROGRESS')],
            }),
          ]),
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A9_DEPENDENCY_NOT_SATISFIED);
    });

    it('does not treat CANCELLED as satisfying a required dependency', () => {
      const input = baseInput({
        visits: [
          visit('v1', 'IN_PROGRESS', [
            step(1, 'CANCELLED'),
            step(2, 'IN_PROGRESS', {
              dependsOnStepIds: [1],
              assignments: [assignment(100, 4, 'IN_PROGRESS')],
            }),
          ]),
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A9_DEPENDENCY_NOT_SATISFIED);
    });
  });

  describe('A10 — routing must not select an ineligible room', () => {
    it('flags a decision whose selectedRoomId is not among the eligible candidates recorded for it', () => {
      const input = baseInput({
        routingDecisions: [{ visitStepId: 1, selectedRoomId: 9, eligibleRoomIds: [4, 5] }],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A10_INELIGIBLE_ROOM_SELECTED);
    });

    it('does not flag a null selection (NO_ELIGIBLE_ROOM failure — nothing was actually selected)', () => {
      const input = baseInput({
        routingDecisions: [{ visitStepId: 1, selectedRoomId: null, eligibleRoomIds: [] }],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A10_INELIGIBLE_ROOM_SELECTED);
    });
  });

  describe('A11 — no patient stuck indefinitely without reason', () => {
    it('flags a non-terminal step that has not changed status for longer than the threshold', () => {
      const input = baseInput({
        nowMs: 1_000_000,
        stuckThresholdMs: 300_000,
        visits: [visit('v1', 'WAITING', [step(1, 'CHECKED_IN', { updatedAtMs: 0 })])],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A11_PATIENT_STUCK);
    });

    it('does not flag a step well within the threshold', () => {
      const input = baseInput({
        nowMs: 100_000,
        stuckThresholdMs: 300_000,
        visits: [visit('v1', 'WAITING', [step(1, 'CHECKED_IN', { updatedAtMs: 90_000 })])],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A11_PATIENT_STUCK);
    });

    it('never flags a terminal step no matter how old', () => {
      const input = baseInput({
        nowMs: 10_000_000,
        stuckThresholdMs: 300_000,
        visits: [visit('v1', 'COMPLETED', [step(1, 'COMPLETED', { updatedAtMs: 0 })])],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A11_PATIENT_STUCK);
    });

    it('does not flag LOCKED or READY siblings that are legitimately waiting their turn', () => {
      const input = baseInput({
        nowMs: 10_000_000,
        stuckThresholdMs: 300_000,
        visits: [
          visit('v1', 'IN_PROGRESS', [
            step(1, 'IN_PROGRESS', {
              updatedAtMs: 9_900_000,
              assignments: [assignment(100, 4, 'IN_PROGRESS')],
            }),
            step(2, 'READY', { updatedAtMs: 0 }),
            step(3, 'LOCKED', { updatedAtMs: 0 }),
          ]),
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A11_PATIENT_STUCK);
    });
  });

  describe('A12 — no orphaned routing queue entry', () => {
    it('flags a PENDING entry that has waited longer than routingMaxPendingMs', () => {
      const input = baseInput({
        nowMs: 100_000,
        routingMaxPendingMs: 60_000,
        routingQueueEntries: [{ visitStepId: 1, status: 'PENDING', enqueueAtMs: 0 }],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).toContain(ASSERTION_RULES.A12_ORPHANED_ROUTING_ENTRY);
    });

    it('does not flag a FAILED entry (already given up by the cron, a different concern)', () => {
      const input = baseInput({
        nowMs: 100_000,
        routingMaxPendingMs: 60_000,
        routingQueueEntries: [{ visitStepId: 1, status: 'FAILED', enqueueAtMs: 0 }],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A12_ORPHANED_ROUTING_ENTRY);
    });

    it('does not flag a PENDING entry still within the window', () => {
      const input = baseInput({
        nowMs: 10_000,
        routingMaxPendingMs: 60_000,
        routingQueueEntries: [{ visitStepId: 1, status: 'PENDING', enqueueAtMs: 0 }],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A12_ORPHANED_ROUTING_ENTRY);
    });

    it('does not flag a READY sibling while the same visit has an active assignment', () => {
      const input = baseInput({
        nowMs: 100_000,
        routingMaxPendingMs: 60_000,
        visits: [
          visit('v1', 'IN_PROGRESS', [
            step(1, 'IN_PROGRESS', {
              assignments: [assignment(100, 4, 'IN_PROGRESS')],
            }),
            step(2, 'READY'),
          ]),
        ],
        routingQueueEntries: [
          { visitStepId: 2, status: 'PENDING', enqueueAtMs: 0 },
        ],
      });
      const { violations } = evaluateSimulationAssertions(input);
      expect(rulesOf(violations)).not.toContain(ASSERTION_RULES.A12_ORPHANED_ROUTING_ENTRY);
    });
  });
});
