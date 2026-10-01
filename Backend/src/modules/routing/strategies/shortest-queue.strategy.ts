import {
  RoutingCandidate,
  RoutingDecisionResult,
  RoutingStrategy,
} from './routing-strategy.interface';

/** Bỏ qua avgProcessTime hoàn toàn — chỉ nhìn số người đang chờ/đang khám
 * tại mỗi phòng. Hữu ích làm đường so sánh (baseline) với chiến lược mặc
 * định: nếu 2 chiến lược cho waiting-time thực tế gần giống nhau, nghĩa là
 * avgProcessTime hiện tại không tạo khác biệt đáng kể giữa các phòng cùng
 * RoomType — 1 tín hiệu đáng ngờ nếu bạn NGHĨ RẰNG các phòng có tốc độ khám
 * khác nhau rõ rệt (xem docs/simulator-architecture.md §1.4 — trên thực tế
 * hiện avgProcessTime là thuộc tính của RoomType, không phải Room, nên MỌI
 * phòng cùng RoomType đã LUÔN có avgProcessTime giống hệt nhau). */
export class ShortestQueueStrategy implements RoutingStrategy {
  readonly name = 'SHORTEST_QUEUE' as const;

  select(candidates: RoutingCandidate[]): RoutingDecisionResult {
    const sorted = [...candidates].sort(
      (a, b) =>
        a.inServiceCount +
          a.waitingCount -
          (b.inServiceCount + b.waitingCount) ||
        a.room.sortOrder - b.room.sortOrder,
    );
    const chosen = sorted[0];
    const chosenQueueLength = chosen.inServiceCount + chosen.waitingCount;
    const isTie =
      sorted.length > 1 &&
      sorted[1].inServiceCount + sorted[1].waitingCount === chosenQueueLength;

    return {
      selectedVisitStepId: chosen.visitStepId,
      selectedRoomId: chosen.room.id,
      reason: isTie ? 'TIE_BREAK_SORT_ORDER' : 'SHORTEST_QUEUE',
    };
  }
}
