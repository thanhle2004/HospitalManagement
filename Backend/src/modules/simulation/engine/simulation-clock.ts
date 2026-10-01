/**
 * Đồng hồ ảo của Simulator — không có mối liên hệ nào với wall-clock/Date
 * thật ngoại trừ khi ở chế độ PACED (để hiển thị "chạy 2x tốc độ thật" cho
 * người xem trên UI). Đây là lý do mọi metric của simulator được tính từ
 * SimulationEvent.simTimeMs, KHÔNG BAO GIỜ từ timestamp thật của DB (xem
 * docs/simulator-architecture.md §2.7 "Wall-clock vs simulation-clock").
 */

export type ClockPolicyKind = 'ASAP' | 'PACED' | 'STEP';
export type SimulationSpeed = 1 | 2 | 5 | 10 | 50;

export interface ClockConfig {
  /** ASAP: nhảy tức thì tới sự kiện tiếp theo — dùng khi chạy headless để
   * lấy kết quả nhanh nhất (LOCKSTEP xác thực logic, hoặc CONCURRENT chạy
   * hết tốc lực để đo race condition).
   * PACED: chờ theo tỉ lệ `speed` — dùng khi có người đang xem live trên
   * Admin UI (Phase 6).
   * STEP: không tự chạy — chờ step() được gọi tường minh cho từng sự kiện,
   * dùng cho nút "Step" trên UI hoặc khi debug từng bước 1. */
  policy: ClockPolicyKind;
  /** Chỉ có ý nghĩa khi policy = 'PACED'. Mặc định 1. */
  speed?: SimulationSpeed;
}

export type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class SimulationClock {
  private simTimeMs = 0;
  private paused = false;
  private pauseWaiters: Array<() => void> = [];
  private stepWaiters: Array<() => void> = [];

  constructor(
    private config: ClockConfig,
    private readonly sleep: SleepFn = defaultSleep,
  ) {}

  get now(): number {
    return this.simTimeMs;
  }

  get policy(): ClockPolicyKind {
    return this.config.policy;
  }

  /** Chỉ có tác dụng khi policy = 'PACED' — vô hại (no-op) ở policy khác,
   * caller (SimulationEngine.setSpeed) không cần biết policy hiện tại. */
  setSpeed(speed: SimulationSpeed): void {
    this.config = { ...this.config, speed };
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    const waiters = this.pauseWaiters;
    this.pauseWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Giải phóng ĐÚNG 1 lời gọi advanceTo() đang chờ ở policy STEP. Gọi khi
   * policy khác STEP là no-op an toàn (không có ai đang chờ để giải phóng). */
  step(): void {
    const waiter = this.stepWaiters.shift();
    if (waiter) waiter();
  }

  /**
   * Tiến đồng hồ tới targetSimTimeMs, chờ theo đúng policy hiện tại, rồi
   * commit thời gian mới. KHÔNG BAO GIỜ lùi thời gian — gọi với target nhỏ
   * hơn `now` là lỗi lập trình (1 event trong quá khứ của chính đồng hồ),
   * ném lỗi ngay thay vì âm thầm bỏ qua.
   *
   * Giới hạn đã biết: nếu pause() xảy ra GIỮA lúc đang chờ (PACED) hoặc
   * đang chờ step() (STEP), việc tạm dừng chỉ có hiệu lực ở ranh giới sự
   * kiện tiếp theo, không ngắt ngay lập tức — chấp nhận được vì các thao
   * tác pause/resume/step của Admin UI có độ trễ tự nhiên ở mức giây, còn
   * khoảng chờ giữa 2 sự kiện mô phỏng thường ngắn hơn nhiều.
   */
  async advanceTo(targetSimTimeMs: number): Promise<void> {
    if (targetSimTimeMs < this.simTimeMs) {
      throw new Error(
        `SimulationClock.advanceTo(): không thể lùi thời gian (hiện tại=${this.simTimeMs}ms, mục tiêu=${targetSimTimeMs}ms)`,
      );
    }

    if (this.config.policy === 'STEP') {
      await new Promise<void>((resolve) => this.stepWaiters.push(resolve));
    } else if (this.config.policy === 'PACED') {
      const deltaSimMs = targetSimTimeMs - this.simTimeMs;
      const speed = this.config.speed ?? 1;
      const realDelayMs = deltaSimMs / speed;
      if (realDelayMs > 0) await this.sleep(realDelayMs);
    }
    // ASAP: không chờ gì — nhảy tức thì tới target

    await this.waitWhilePaused();

    this.simTimeMs = targetSimTimeMs;
  }

  private waitWhilePaused(): Promise<void> {
    if (!this.paused) return Promise.resolve();
    return new Promise<void>((resolve) => this.pauseWaiters.push(resolve));
  }

  /** Đánh thức MỌI advanceTo() đang bị chặn — dù đang chờ resume() (PAUSED)
   * hay đang chờ step() (policy STEP). CHỈ dùng để dừng hẳn run loop
   * (SimulationEngine.stop()) — resume() thường KHÔNG đủ, vì resume() chỉ
   * giải phóng nhánh PAUSED chứ không giải phóng nhánh đang chờ step(), nên
   * 1 lệnh stop() đến trong lúc clock đang chờ step() sẽ kẹt mãi nếu chỉ
   * gọi resume(). KHÔNG dùng cho luồng pause/resume/step thông thường. */
  forceWake(): void {
    this.paused = false;

    const pauseWaiters = this.pauseWaiters;
    this.pauseWaiters = [];
    pauseWaiters.forEach((resolve) => resolve());

    const stepWaiters = this.stepWaiters;
    this.stepWaiters = [];
    stepWaiters.forEach((resolve) => resolve());
  }
}