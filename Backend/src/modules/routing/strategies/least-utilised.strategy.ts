import {
  RoutingCandidate,
  RoutingDecisionResult,
  RoutingStrategy,
} from './routing-strategy.interface';

/**
 * Ưu tiên phòng ÍT BẬN nhất — nhưng "độ bận" ở đây là 1 XẤP XỈ có chủ đích,
 * không phải utilisation thật:
 *
 *   utilisation(room) = (số lần select() thấy room này activeCount > 0)
 *                      / (tổng số lần select() được hỏi có room này trong
 *                         danh sách ứng viên)
 *
 * Đây là lấy mẫu TẠI THỜI ĐIỂM ra quyết định routing, không phải trung bình
 * theo thời gian thực (time-weighted) — 1 phòng có thể "bận" trong 90% thời
 * gian thực nhưng nếu routing chỉ được hỏi vào đúng những lúc phòng đó rảnh
 * thì con số ở đây vẫn thấp. Muốn utilisation thật cần
 * MetricsCollector theo dõi busy-time tích luỹ theo simulation clock (xem
 * docs/simulator-architecture.md §10) — việc đó thuộc Phase 4+, CHƯA làm ở
 * đây. Ghi rõ giới hạn này thay vì che giấu, vì strategy này sẽ được dùng để
 * SO SÁNH với chiến lược khác trong 1 thesis — kết quả sai lệch do xấp xỉ
 * cần được biết trước, không phải phát hiện sau khi đã kết luận.
 *
 * CÓ TRẠNG THÁI (tích luỹ qua nhiều lần gọi, giống RoundRobinStrategy) —
 * phải dùng lại đúng 1 instance qua toàn bộ vòng đời ứng dụng/run.
 */
export class LeastUtilisedStrategy implements RoutingStrategy {
  readonly name = 'LEAST_UTILISED' as const;

  private readonly busyObservations = new Map<number, number>();
  private readonly totalObservations = new Map<number, number>();

  select(candidates: RoutingCandidate[]): RoutingDecisionResult {
    const ranked = candidates
      .map((c) => {
        const total = (this.totalObservations.get(c.room.id) ?? 0) + 1;
        const busy =
          (this.busyObservations.get(c.room.id) ?? 0) +
          (c.inServiceCount + c.waitingCount > 0 ? 1 : 0);
        this.totalObservations.set(c.room.id, total);
        this.busyObservations.set(c.room.id, busy);
        return { candidate: c, utilisation: busy / total };
      })
      .sort(
        (a, b) =>
          a.utilisation - b.utilisation || a.candidate.room.sortOrder - b.candidate.room.sortOrder,
      );

    return {
      selectedVisitStepId: ranked[0].candidate.visitStepId,
      selectedRoomId: ranked[0].candidate.room.id,
      reason: 'LEAST_UTILISED',
    };
  }
}
