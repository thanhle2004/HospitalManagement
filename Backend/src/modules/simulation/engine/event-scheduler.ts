/**
 * Hàng đợi sự kiện của Simulator — min-heap nhị phân theo (simTimeMs, seq).
 *
 * KHÔNG dùng hàng trăm setTimeout() (xem docs/simulator-architecture.md §6.3
 * "Do NOT rely on hundreds of setTimeout() calls") — 1 đồng hồ ảo trung tâm
 * (SimulationClock) chỉ nhảy tới thời điểm của sự kiện tiếp theo trong hàng
 * đợi này.
 *
 * `seq` là bộ đếm tăng dần gán tại thời điểm schedule() — đảm bảo 2 sự kiện
 * trùng simTimeMs luôn được xử lý theo ĐÚNG thứ tự chúng được lên lịch, không
 * phụ thuộc cách cài đặt heap. Đây là thứ khiến chế độ LOCKSTEP phát lại
 * (replay) tất định tuyệt đối với cùng 1 seed.
 */

export interface ScheduledEvent<TType extends string = string, TPayload = unknown> {
  simTimeMs: number;
  /** Gán tự động bởi scheduler khi schedule() — không tự đặt tay. */
  seq: number;
  type: TType;
  visitId?: string;
  visitStepId?: number;
  roomId?: number;
  payload?: TPayload;
}

export type ScheduleEventInput<TType extends string = string, TPayload = unknown> = Omit<
  ScheduledEvent<TType, TPayload>,
  'seq'
>;

function compareEvents(a: ScheduledEvent, b: ScheduledEvent): number {
  if (a.simTimeMs !== b.simTimeMs) return a.simTimeMs - b.simTimeMs;
  return a.seq - b.seq;
}

export class EventScheduler<TType extends string = string, TPayload = unknown> {
  private heap: ScheduledEvent<TType, TPayload>[] = [];
  private nextSeq = 0;

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /** Thêm 1 sự kiện. simTimeMs KHÔNG được nhỏ hơn 0 — nhỏ hơn thời gian hiện
   * tại của clock thì vẫn hợp lệ ở cấp scheduler (schedule "trong quá khứ"
   * của handler khác đã chạy trước), việc từ chối lùi thời gian là trách
   * nhiệm của SimulationClock.advanceTo(), không phải của hàng đợi này. */
  schedule(event: ScheduleEventInput<TType, TPayload>): ScheduledEvent<TType, TPayload> {
    if (event.simTimeMs < 0) {
      throw new Error(`EventScheduler.schedule(): simTimeMs không được âm (${event.simTimeMs})`);
    }
    const full: ScheduledEvent<TType, TPayload> = { ...event, seq: this.nextSeq++ };
    this.heap.push(full);
    this.bubbleUp(this.heap.length - 1);
    return full;
  }

  /** Xem sự kiện tiếp theo mà KHÔNG lấy ra khỏi hàng đợi. */
  peek(): ScheduledEvent<TType, TPayload> | undefined {
    return this.heap[0];
  }

  /** Lấy và xoá sự kiện có (simTimeMs, seq) nhỏ nhất. */
  popNext(): ScheduledEvent<TType, TPayload> | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop() as ScheduledEvent<TType, TPayload>;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  /** Huỷ mọi sự kiện khớp predicate (vd bệnh nhân "abandon" hàng đợi trước
   * khi sự kiện SERVICE_START đã lên lịch cho họ chạy tới) — trả về số
   * lượng đã huỷ. O(n) — chấp nhận được vì hàng đợi chỉ có tối đa vài nghìn
   * sự kiện đang chờ trong 1 scenario. */
  cancelWhere(predicate: (event: ScheduledEvent<TType, TPayload>) => boolean): number {
    const before = this.heap.length;
    this.heap = this.heap.filter((e) => !predicate(e));
    this.heapify();
    return before - this.heap.length;
  }

  clear(): void {
    this.heap = [];
  }

  /** Toàn bộ sự kiện còn lại, theo đúng thứ tự xử lý — CHỈ dùng để debug/test, tốn O(n log n), không dùng trong run loop nóng. */
  toSortedArray(): ScheduledEvent<TType, TPayload>[] {
    return [...this.heap].sort(compareEvents);
  }

  private heapify(): void {
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
      this.bubbleDown(i);
    }
  }

  private bubbleUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (compareEvents(this.heap[i], this.heap[parent]) >= 0) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private bubbleDown(index: number): void {
    let i = index;
    const n = this.heap.length;
    for (;;) {
      const left = i * 2 + 1;
      const right = i * 2 + 2;
      let smallest = i;
      if (left < n && compareEvents(this.heap[left], this.heap[smallest]) < 0) smallest = left;
      if (right < n && compareEvents(this.heap[right], this.heap[smallest]) < 0) smallest = right;
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(i: number, j: number): void {
    const tmp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = tmp;
  }
}