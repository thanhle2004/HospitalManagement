import {
  RoutingCandidate,
  RoutingDecisionResult,
  RoutingStrategy,
  RoutingStrategyContext,
} from './routing-strategy.interface';

export class RandomStrategy implements RoutingStrategy {
  readonly name = 'RANDOM' as const;

  select(candidates: RoutingCandidate[], ctx?: RoutingStrategyContext): RoutingDecisionResult {
    const random = ctx?.random ?? Math.random;
    // Kẹp về phần tử cuối cùng phòng trường hợp random() trả đúng 1.0 (hợp
    // lệ với Math.random() theo đặc tả nhưng cực hiếm) — tránh index tràn.
    const index = Math.min(Math.floor(random() * candidates.length), candidates.length - 1);
    const chosen = candidates[index];

    return {
      selectedVisitStepId: chosen.visitStepId,
      selectedRoomId: chosen.room.id,
      reason: 'RANDOM',
    };
  }
}