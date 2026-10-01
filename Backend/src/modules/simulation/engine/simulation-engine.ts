/**
 * Vòng lặp điều phối trung tâm của Simulator (xem
 * docs/simulator-architecture.md §3.1, §4, §6.3).
 *
 * CHỈ orchestrate — không chứa bất kỳ logic nghiệp vụ bệnh viện nào (không
 * biết Patient/Visit/Room là gì). PatientGenerator/DoctorSimulator (Phase 2)
 * đăng ký handler cho từng loại sự kiện bằng on(type, handler); handler đó
 * mới là nơi gọi các service production thật (VisitsService, CheckInService,
 * DoctorService...).
 *
 * 2 chế độ (`mode`), CÙNG 1 vòng lặp, khác nhau đúng 1 chỗ — cách 1 "tick"
 * (mọi sự kiện cùng simTimeMs) được xử lý:
 *  - LOCKSTEP: TUẦN TỰ từng sự kiện, await đầy đủ mọi effect (kể cả những
 *    schedule() lồng bên trong handler) trước khi chuyển sang sự kiện tiếp
 *    theo. Tất định tuyệt đối với cùng 1 seed (xem simulation-engine.spec.ts
 *    "determinism (Phase 1 gate)").
 *  - CONCURRENT [Phase 5]: TOÀN BỘ sự kiện cùng simTimeMs được dispatch
 *    ĐỒNG THỜI (qua runWithConcurrencyLimit — Promise.allSettled có giới
 *    hạn mức song song, xem concurrency-limiter.ts), giống hệt cách N
 *    request thật cùng lúc chạm production code. Input (thời điểm/nội dung
 *    từng sự kiện) vẫn tất định theo seed — nhưng THỨ TỰ các thao tác DB
 *    bên trong handler xen kẽ nhau không còn được kiểm soát nữa.
 *
 * Chạy CÙNG 1 scenario + seed ở cả 2 mode rồi so sánh kết quả cuối cùng
 * (xem metrics/outcome-diff.ts) CHÍNH LÀ cách phát hiện race condition mà
 * không cần đoán trước lỗi nằm ở đâu — bất kỳ khác biệt nào giữa 2 kết quả,
 * theo định nghĩa, chỉ có thể do race gây ra (assertion A13, §3.1).
 */

import { SeededRng } from './rng';
import {
  EventScheduler,
  ScheduledEvent,
  ScheduleEventInput,
} from './event-scheduler';
import { ClockConfig, SimulationClock, SimulationSpeed, SleepFn } from './simulation-clock';
import { runWithConcurrencyLimit } from './concurrency-limiter';

export type SimulationEngineStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PAUSED'
  | 'STOPPED'
  | 'COMPLETED'
  | 'FAILED';

export type SimulationEngineStopReason = 'COMPLETED' | 'STOPPED' | 'MAX_EVENTS_EXCEEDED';

export interface SimulationEngineContext<TType extends string = string, TPayload = unknown> {
  /** simTimeMs của sự kiện đang được xử lý — KHÔNG phải Date.now(). */
  readonly now: number;
  readonly rng: SeededRng;
  schedule(
    event: ScheduleEventInput<TType, TPayload>,
  ): ScheduledEvent<TType, TPayload>;
}

export type EventHandler<TType extends string = string, TPayload = unknown> = (
  event: ScheduledEvent<TType, TPayload>,
  ctx: SimulationEngineContext<TType, TPayload>,
) => Promise<void> | void;

/** [Phase 5] Gọi khi dispatch 1 sự kiện ở CONCURRENT mode ném lỗi. KHÔNG
 * bao giờ gọi ở LOCKSTEP — ở đó lỗi vẫn propagate thẳng ra run() như trước
 * (làm FAILED cả run, xem test "a handler that throws fails the run"), vì
 * LOCKSTEP dùng để xác thực LOGIC đúng/sai tuyệt đối, không phải để "chịu
 * đựng" lỗi giống production. CONCURRENT thì ngược lại: 1 request thật lỗi
 * không được phép crash cả server, nên 1 sự kiện lỗi ở đây chỉ được báo lại
 * qua hook này, không làm hỏng các sự kiện khác đang chạy song song. */
export type EventErrorHandler<TType extends string = string, TPayload = unknown> = (
  event: ScheduledEvent<TType, TPayload>,
  error: unknown,
) => void;

export interface SimulationEngineOptions {
  seed: number;
  mode: 'LOCKSTEP' | 'CONCURRENT';
  clock: ClockConfig;
  /** Giới hạn an toàn — dừng nếu vượt quá số sự kiện đã xử lý (chặn vòng lặp
   * vô hạn khi 1 handler tự lên lịch lại chính nó với delay = 0 do lỗi lập
   * trình ở actor). Mặc định 200 000. Ở CONCURRENT, 1 lần kiểm tra có thể
   * để lọt nguyên 1 "tick" (1 batch sự kiện cùng simTimeMs) vượt nhẹ qua
   * ngưỡng này trước khi dừng — đây là van an toàn, không phải giới hạn
   * chính xác tuyệt đối. */
  maxEvents?: number;
  /** CHỈ có ý nghĩa ở CONCURRENT — số sự kiện tối đa dispatch song song
   * trong CÙNG 1 tick. Mặc định không giới hạn (bằng đúng số sự kiện của
   * tick đó) — xem cảnh báo về Prisma connection pool ở
   * docs/simulator-architecture.md §2.5 nếu muốn kiểm soát mức độ song song
   * để tách bạch "hospital bị nghẽn" khỏi "hạ tầng bị nghẽn". */
  concurrencyLimit?: number;
}

export class SimulationEngine<TType extends string = string, TPayload = unknown> {
  readonly rng: SeededRng;
  readonly clock: SimulationClock;
  private readonly scheduler = new EventScheduler<TType, TPayload>();
  private readonly handlers = new Map<TType, EventHandler<TType, TPayload>[]>();
  /** [Phase 4] Observer chạy cho MỌI event đã dispatch THÀNH CÔNG, không
   * phân biệt type — nguồn dữ liệu cho MetricsCollector và bộ ghi
   * SimulationEvent xuống DB (xem docs/simulator-architecture.md §10, §5.3).
   * Tách khỏi `handlers` có chủ đích: 1 observer không được phép ném lỗi
   * làm hỏng run loop, và không tham gia vào ngữ nghĩa LOCKSTEP (không nhận
   * ctx, không được schedule() thêm sự kiện). "Thành công" nghĩa là handler
   * của sự kiện đó không ném lỗi — 1 sự kiện lỗi ở CONCURRENT mode KHÔNG
   * được báo qua đây, xem onEventError(). */
  private readonly everyEventListeners: Array<
    (event: ScheduledEvent<TType, TPayload>) => void
  > = [];
  /** [Phase 5] Xem EventErrorHandler ở trên. */
  private readonly eventErrorListeners: EventErrorHandler<TType, TPayload>[] = [];
  private readonly maxEvents: number;

  private _status: SimulationEngineStatus = 'PENDING';
  private processedCount = 0;
  private stopRequested = false;

  constructor(private readonly options: SimulationEngineOptions, sleepFn?: SleepFn) {
    this.rng = new SeededRng(options.seed);
    this.clock = new SimulationClock(options.clock, sleepFn);
    this.maxEvents = options.maxEvents ?? 200_000;
  }

  get status(): SimulationEngineStatus {
    return this._status;
  }

  get mode(): SimulationEngineOptions['mode'] {
    return this.options.mode;
  }

  get processedEventCount(): number {
    return this.processedCount;
  }

  get pendingEventCount(): number {
    return this.scheduler.size;
  }

  /** Đăng ký 1 handler cho 1 loại sự kiện. Nhiều handler cho cùng 1 loại sự
   * kiện luôn chạy tuần tự theo thứ tự đăng ký (kể cả ở CONCURRENT — tính
   * "song song" của CONCURRENT là giữa CÁC SỰ KIỆN KHÁC NHAU trong cùng 1
   * tick, không phải giữa các handler của CÙNG 1 sự kiện). */
  on(type: TType, handler: EventHandler<TType, TPayload>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  /** [Phase 4] Đăng ký 1 observer chạy cho MỌI event dispatch thành công.
   * Lỗi ném ra từ observer bị NUỐT (chỉ log ra console) — 1 observer bug
   * (vd MetricsCollector) không được phép làm FAILED cả run mô phỏng. */
  onEveryEvent(listener: (event: ScheduledEvent<TType, TPayload>) => void): void {
    this.everyEventListeners.push(listener);
  }

  /** [Phase 5] Đăng ký 1 listener nhận lỗi dispatch ở CONCURRENT mode — xem EventErrorHandler. */
  onEventError(listener: EventErrorHandler<TType, TPayload>): void {
    this.eventErrorListeners.push(listener);
  }

  /** Lên lịch 1 sự kiện từ bên ngoài run loop — dùng để "gieo" (seed) sự
   * kiện đầu tiên trước khi gọi run() (vd PATIENT_ARRIVED đầu tiên của
   * PatientGenerator). Bên trong 1 handler, dùng ctx.schedule() thay vì gọi
   * thẳng vào đây, để scheduling luôn đi qua đúng "cửa" mà run loop theo dõi. */
  schedule(event: ScheduleEventInput<TType, TPayload>): ScheduledEvent<TType, TPayload> {
    return this.scheduler.schedule(event);
  }

  /** Huỷ mọi sự kiện đang chờ khớp predicate — xem EventScheduler.cancelWhere(). */
  cancelWhere(predicate: (event: ScheduledEvent<TType, TPayload>) => boolean): number {
    return this.scheduler.cancelWhere(predicate);
  }

  pause(): void {
    if (this._status !== 'RUNNING') return;
    this._status = 'PAUSED';
    this.clock.pause();
  }

  resume(): void {
    if (this._status !== 'PAUSED') return;
    this._status = 'RUNNING';
    this.clock.resume();
  }

  setSpeed(speed: SimulationSpeed): void {
    this.clock.setSpeed(speed);
  }

  /** Giải phóng đúng 1 sự kiện tiếp theo — chỉ có tác dụng khi clock.policy = 'STEP'. */
  step(): void {
    this.clock.step();
  }

  /** Yêu cầu dừng chạy. run() sẽ dừng ở ranh giới tick an toàn tiếp theo
   * (không cắt ngang 1 handler/1 batch đang chạy dở). resume() clock để đảm
   * bảo run loop không bị kẹt mãi ở PAUSED/STEP chờ 1 tín hiệu sẽ không bao
   * giờ tới. */
  stop(): void {
    this.stopRequested = true;
    this.clock.forceWake();
  }

  /**
   * Chạy tới khi hàng đợi rỗng, hoặc bị stop(), hoặc vượt maxEvents.
   * CHỈ gọi được đúng 1 lần từ trạng thái PENDING — muốn chạy lại 1 scenario
   * thì tạo SimulationEngine mới (mỗi lần chạy có 1 vòng đời riêng, không
   * tái sử dụng instance đã COMPLETED/STOPPED/FAILED).
   */
  async run(): Promise<SimulationEngineStopReason> {
    if (this._status !== 'PENDING') {
      throw new Error(
        `SimulationEngine.run(): chỉ gọi được từ trạng thái PENDING (hiện tại: ${this._status})`,
      );
    }
    this._status = 'RUNNING';

    try {
      while (!this.scheduler.isEmpty()) {
        if (this.stopRequested) {
          this._status = 'STOPPED';
          return 'STOPPED';
        }
        if (this.processedCount >= this.maxEvents) {
          this._status = 'FAILED';
          return 'MAX_EVENTS_EXCEEDED';
        }

        const next = this.scheduler.peek() as ScheduledEvent<TType, TPayload>;
        await this.clock.advanceTo(next.simTimeMs);

        // stop() có thể đến trong lúc advanceTo() đang chờ (PACED/STEP/paused)
        if (this.stopRequested) {
          this._status = 'STOPPED';
          return 'STOPPED';
        }

        if (this.options.mode === 'LOCKSTEP') {
          const event = this.scheduler.popNext() as ScheduledEvent<TType, TPayload>;
          this.processedCount += 1;
          await this.dispatch(event);
        } else {
          const batch = this.popTick(next.simTimeMs);
          this.processedCount += batch.length;
          await this.dispatchTickConcurrently(batch);
        }
      }

      this._status = 'COMPLETED';
      return 'COMPLETED';
    } catch (err) {
      this._status = 'FAILED';
      throw err;
    }
  }

  /** Lấy TOÀN BỘ sự kiện đang chờ có ĐÚNG simTimeMs này ra khỏi hàng đợi —
   * đây là "1 tick" của CONCURRENT mode. Dùng popNext() lặp lại (không phải
   * 1 lần quét toàn bộ heap) để giữ đúng bất biến của EventScheduler. */
  private popTick(simTimeMs: number): ScheduledEvent<TType, TPayload>[] {
    const batch: ScheduledEvent<TType, TPayload>[] = [];
    while (!this.scheduler.isEmpty() && this.scheduler.peek()!.simTimeMs === simTimeMs) {
      batch.push(this.scheduler.popNext() as ScheduledEvent<TType, TPayload>);
    }
    return batch;
  }

  private async dispatchTickConcurrently(
    batch: ScheduledEvent<TType, TPayload>[],
  ): Promise<void> {
    const limit = this.options.concurrencyLimit ?? batch.length;
    await runWithConcurrencyLimit(batch, limit, (event) => this.dispatchConcurrentSafe(event));
  }

  /** LOCKSTEP — lỗi propagate thẳng ra run(), làm FAILED cả run (hành vi
   * KHÔNG đổi từ Phase 1, xem simulation-engine.spec.ts). */
  private async dispatch(event: ScheduledEvent<TType, TPayload>): Promise<void> {
    await this.runHandlers(event);
    this.notifyEveryEventListeners(event);
  }

  /** CONCURRENT — lỗi của 1 sự kiện KHÔNG được phép làm hỏng các sự kiện
   * khác đang chạy song song trong cùng tick (giống production: 1 request
   * lỗi không crash cả server) — báo qua onEventError() thay vì propagate.
   * Cố ý KHÔNG gọi onEveryEvent() cho sự kiện lỗi — metrics/event-log không
   * nên ghi nhận 1 sự kiện như thể nó đã xử lý xong khi thực ra đã thất bại. */
  private async dispatchConcurrentSafe(event: ScheduledEvent<TType, TPayload>): Promise<void> {
    try {
      await this.runHandlers(event);
      this.notifyEveryEventListeners(event);
    } catch (err) {
      this.notifyEventErrorListeners(event, err);
    }
  }

  private async runHandlers(event: ScheduledEvent<TType, TPayload>): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];
    const ctx: SimulationEngineContext<TType, TPayload> = {
      now: event.simTimeMs,
      rng: this.rng,
      schedule: (e) => this.schedule(e),
    };
    for (const handler of handlers) {
      await handler(event, ctx);
    }
  }

  private notifyEveryEventListeners(event: ScheduledEvent<TType, TPayload>): void {
    for (const listener of this.everyEventListeners) {
      try {
        listener(event);
      } catch (err) {
        // eslint-disable-next-line no-console -- observer lỗi không được phép làm FAILED cả run; log thẳng ra console vì đây là lớp hạ tầng, không có Logger riêng
        console.error('SimulationEngine.onEveryEvent listener threw (bỏ qua, tiếp tục run):', err);
      }
    }
  }

  private notifyEventErrorListeners(event: ScheduledEvent<TType, TPayload>, error: unknown): void {
    if (this.eventErrorListeners.length === 0) {
      // eslint-disable-next-line no-console -- không có ai lắng nghe lỗi CONCURRENT — vẫn phải log ra đâu đó, không được nuốt hoàn toàn
      console.error(
        `SimulationEngine (CONCURRENT): sự kiện ${event.type}#${event.seq} lỗi và không có onEventError() nào lắng nghe:`,
        error,
      );
      return;
    }
    for (const listener of this.eventErrorListeners) {
      try {
        listener(event, error);
      } catch (err) {
        // eslint-disable-next-line no-console -- tương tự onEveryEvent — listener lỗi không được lan ra ngoài
        console.error('SimulationEngine.onEventError listener threw (bỏ qua, tiếp tục run):', err);
      }
    }
  }
}