import {
  RoutingCandidate,
  RoutingDecisionResult,
  RoutingStrategy,
} from './routing-strategy.interface';

/** Mục tiêu routing production duy nhất: ETA chờ nhỏ nhất. */
export class MinEstimatedWaitingTimeStrategy implements RoutingStrategy {
  readonly name = 'MIN_ESTIMATED_WAITING_TIME' as const;

  select(candidates: RoutingCandidate[]): RoutingDecisionResult {
    const sorted = [...candidates].sort(
      (a, b) =>
        a.estimatedWaitingSeconds - b.estimatedWaitingSeconds ||
        a.visitStepDisplayOrder - b.visitStepDisplayOrder ||
        a.room.sortOrder - b.room.sortOrder ||
        a.visitStepId - b.visitStepId ||
        a.room.id - b.room.id,
    );
    const chosen = sorted[0];
    const isTie =
      sorted.length > 1 &&
      sorted[1].estimatedWaitingSeconds === chosen.estimatedWaitingSeconds;

    return {
      selectedVisitStepId: chosen.visitStepId,
      selectedRoomId: chosen.room.id,
      reason: isTie ? 'DETERMINISTIC_TIE_BREAK' : 'MIN_ESTIMATED_WAITING_TIME',
    };
  }
}
