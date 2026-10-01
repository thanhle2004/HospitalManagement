/**
 * Gom sự kiện vào bộ nhớ rồi trả ra theo LÔ — không tự ghi DB (đó là việc
 * của SimulationEventsRepository, gọi từ SimulationOrchestrator). Tách
 * riêng để test được logic "khi nào nên flush" mà không cần Prisma (xem
 * cảnh báo write-volume ở docs/simulator-architecture.md §5.3 — 500 bệnh
 * nhân × ~8 event × vài bước ≈ hàng nghìn dòng, không được ghi từng dòng một
 * lúc đang chạy).
 */

export interface BufferedSimulationEvent {
  simTimeMs: number;
  seq: number;
  type: string;
  visitId?: string;
  visitStepId?: number;
  roomId?: number;
  payload?: unknown;
}

export class SimulationEventBuffer {
  private buffer: BufferedSimulationEvent[] = [];

  constructor(private readonly flushThreshold: number = 500) {
    if (flushThreshold <= 0) {
      throw new Error('SimulationEventBuffer: flushThreshold phải > 0');
    }
  }

  get size(): number {
    return this.buffer.length;
  }

  push(event: BufferedSimulationEvent): void {
    this.buffer.push(event);
  }

  /** true khi buffer đã đầy tới ngưỡng — caller nên flush() ngay ở ranh giới an toàn tiếp theo. */
  shouldFlush(): boolean {
    return this.buffer.length >= this.flushThreshold;
  }

  /** Lấy toàn bộ event đang đệm và làm rỗng buffer — gọi đúng 1 lần trước
   * khi ghi DB; nếu ghi thất bại, caller tự quyết định có đẩy lại
   * (`restore`) hay chấp nhận mất lô đó (mất SimulationEvent KHÔNG làm sai
   * lệch production data — bảng này chỉ phục vụ xem lại/metrics, không phải
   * nguồn sự thật cho routing/queue). */
  drain(): BufferedSimulationEvent[] {
    const drained = this.buffer;
    this.buffer = [];
    return drained;
  }

  /** Đẩy lại 1 lô đã drain() ra đầu buffer — dùng khi 1 lần ghi DB thất bại và muốn thử lại ở lần flush sau thay vì mất dữ liệu. */
  restore(events: readonly BufferedSimulationEvent[]): void {
    this.buffer = [...events, ...this.buffer];
  }
}