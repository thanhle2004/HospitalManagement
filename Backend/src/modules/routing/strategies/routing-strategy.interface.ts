/**
 * Interface tách rời thuật toán "chọn phòng nào" khỏi phần còn lại của
 * RoutingEngineService — đọc dữ liệu ứng viên, ghi VisitAssignment/
 * VisitToken, ghi RoutingDecision (xem docs/simulator-architecture.md §5.1
 * "Extract routing strategy behind an interface").
 *
 * MỌI implementation ở đây PHẢI là hàm THUẦN (không tự query DB, không tự
 * gọi service khác) — toàn bộ dữ liệu cần thiết đi vào qua `candidates`.
 * Điều này giúp:
 *  1. Strategy test được bằng unit test thuần, không cần mock Prisma.
 *  2. Simulator LOCKSTEP (Phase 5+) so sánh công bằng nhiều strategy trên
 *     CÙNG 1 scenario/seed — muốn vậy strategy không được có side-effect ẩn.
 */

export type RoutingStrategyName =
  | 'MIN_ESTIMATED_WAITING_TIME'
  | 'SHORTEST_QUEUE'
  | 'ROUND_ROBIN'
  | 'RANDOM'
  | 'LEAST_UTILISED';

export interface RoutingCandidateRoom {
  id: number;
  roomNumber: string;
  sortOrder: number;
}

export interface RoutingCandidate {
  visitStepId: number;
  visitStepDisplayOrder: number;
  room: RoutingCandidateRoom;
  /** Assignment IN_PROGRESS tại phòng. Bất biến sức chứa phòng giới hạn giá trị này trong 0..1. */
  inServiceCount: number;
  /** Assignment chưa vào khám: WAITING + CHECKED_IN. */
  waitingCount: number;
  /** Room.avgProcessTime nếu có override, ngược lại RoomType.avgProcessTime; đơn vị giây. */
  effectiveAverageProcessTimeSeconds: number;
  /** (inServiceCount + waitingCount) * effectiveAverageProcessTimeSeconds. */
  estimatedWaitingSeconds: number;
}

export interface RoutingStrategyContext {
  /** CHỈ simulator LOCKSTEP truyền vào — cho RandomStrategy tất định theo
   * seed của run (xem docs/simulator-architecture.md §3.4). Production
   * KHÔNG truyền — RandomStrategy tự dùng Math.random(). */
  random?: () => number;
}

export interface RoutingDecisionResult {
  selectedVisitStepId: number;
  selectedRoomId: number;
  /** Vd 'MIN_ESTIMATED_WAITING_TIME', 'TIE_BREAK_SORT_ORDER', 'SHORTEST_QUEUE'. Ghi thẳng vào RoutingDecision.reason. */
  reason: string;
}

export interface RoutingStrategy {
  readonly name: RoutingStrategyName;
  /** `candidates` LUÔN có ít nhất 1 phần tử — RoutingEngineService đã lọc
   * "không có phòng ACTIVE nào thuộc RoomType" TRƯỚC KHI gọi strategy (case
   * đó markFailed() thẳng, không tới đây). */
  select(candidates: RoutingCandidate[], ctx?: RoutingStrategyContext): RoutingDecisionResult;
}
