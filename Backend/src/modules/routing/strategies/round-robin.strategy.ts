import {
  RoutingCandidate,
  RoutingDecisionResult,
  RoutingStrategy,
} from './routing-strategy.interface';

/**
 * Luân phiên tuần tự theo sortOrder — không quan tâm ETA hay độ dài hàng
 * đợi. CÓ TRẠNG THÁI (khác 2 strategy trên): nhớ "lượt trước đã chọn phòng
 * nào" để lần sau chọn phòng KẾ TIẾP, không phải random hay luôn cùng 1
 * phòng.
 *
 * Trạng thái được khoá theo "chữ ký tập ứng viên" (danh sách roomId, sắp
 * tăng dần, nối bằng dấu phẩy) chứ không phải khoá theo RoomType.id — vì 1
 * RoomType có thể có nhiều bộ phòng ACTIVE khác nhau theo thời gian (phòng
 * bị MAINTENANCE tạm thời chẳng hạn); mỗi tập ứng viên khác nhau có vòng
 * quay riêng, tránh nhảy cóc thứ tự khi tập phòng ACTIVE thay đổi.
 *
 * 1 instance của class này PHẢI được dùng lại (singleton) qua nhiều lần
 * gọi select() liên tiếp — nếu tạo instance mới mỗi lần gọi thì "luân
 * phiên" mất hết ý nghĩa (luôn quay về lượt đầu tiên). RoutingStrategyRegistry
 * đảm bảo điều này (đăng ký qua NestJS DI, mặc định singleton).
 */
export class RoundRobinStrategy implements RoutingStrategy {
  readonly name = 'ROUND_ROBIN' as const;

  private readonly lastIndexByCandidateSet = new Map<string, number>();

  select(candidates: RoutingCandidate[]): RoutingDecisionResult {
    const ordered = [...candidates].sort((a, b) => a.room.sortOrder - b.room.sortOrder);
    const signature = ordered.map((c) => `${c.visitStepId}:${c.room.id}`).join(',');

    const lastIndex = this.lastIndexByCandidateSet.get(signature) ?? -1;
    const nextIndex = (lastIndex + 1) % ordered.length;
    this.lastIndexByCandidateSet.set(signature, nextIndex);

    return {
      selectedVisitStepId: ordered[nextIndex].visitStepId,
      selectedRoomId: ordered[nextIndex].room.id,
      reason: 'ROUND_ROBIN',
    };
  }
}