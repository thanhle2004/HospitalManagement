/**
 * Tính toán metrics (§10) HOÀN TOÀN từ nhật ký sự kiện của chính simulator —
 * KHÔNG BAO GIỜ từ timestamp thật của DB (createdAt/updatedAt...), vì đồng
 * hồ mô phỏng và đồng hồ thật là 2 trục thời gian khác nhau khi chạy PACED
 * ở tốc độ khác 1x (xem docs/simulator-architecture.md §2.7).
 *
 * Gắn vào SimulationEngine bằng engine.onEveryEvent(collector.recordEvent).
 * KHÔNG tự đọc DB, KHÔNG phụ thuộc NestJS/Prisma — 1 class thuần, giống hệt
 * tinh thần của engine/ (Phase 1) và routing/strategies/ (Phase 3): dễ test,
 * dễ tái sử dụng ở LOCKSTEP lẫn CONCURRENT (Phase 5).
 *
 * Số lượng patient trong 1 scenario bị chặn ở vài trăm (xem
 * docs/simulator-architecture.md §12), nên giữ toàn bộ mẫu trong mảng rồi
 * sort khi cần quantile là ĐỦ NHANH và CHÍNH XÁC TUYỆT ĐỐI — cố tình KHÔNG
 * dùng cấu trúc quantile xấp xỉ kiểu streaming (P², t-digest...) vì ở quy mô
 * này chúng chỉ thêm độ phức tạp mà không đổi lại lợi ích gì.
 */

export interface RecordableEvent {
  simTimeMs: number;
  type: string;
  visitId?: string;
  visitStepId?: number;
  roomId?: number;
}

export interface QuantileSummary {
  count: number;
  mean: number;
  median: number;
  p95: number;
  max: number;
}

export interface RoomMetrics {
  waitingTimeMs: QuantileSummary;
  serviceTimeMs: QuantileSummary;
  /** Tỉ lệ % thời gian phòng có 1 bệnh nhân IN_PROGRESS, trên tổng thời gian
   * mô phỏng ĐÃ TRÔI QUA (từ event đầu tiên tới event mới nhất được ghi
   * nhận) — KHÔNG phải trên toàn bộ thời lượng dự kiến của scenario, vì
   * collector không biết trước scenario sẽ chạy bao lâu. */
  utilisationPct: number;
  patientsServed: number;
}

export interface MetricsSnapshot {
  /** simTimeMs của event mới nhất đã ghi nhận. */
  simTimeMs: number;
  counters: {
    patientsArrived: number;
    visitsCreated: number;
    visitsCompleted: number;
    noShows: number;
    /** Số VisitStep đã QR_SCANNED nhưng chưa SERVICE_STARTED — mức "bước",
     * không phải "bệnh nhân duy nhất" (1 bệnh nhân đa bước có thể vừa chờ 1
     * bước vừa hoàn tất bước khác cùng lúc trong DAG song song). */
    stepsWaiting: number;
    stepsInService: number;
  };
  waitingTimeMs: QuantileSummary;
  lengthOfStayMs: QuantileSummary;
  serviceTimeMs: QuantileSummary;
  throughputPerSimHour: number;
  perRoom: Record<number, RoomMetrics>;
}

const EMPTY_SUMMARY: QuantileSummary = { count: 0, mean: 0, median: 0, p95: 0, max: 0 };

function summarize(samples: readonly number[]): QuantileSummary {
  if (samples.length === 0) return EMPTY_SUMMARY;
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    count: sorted.length,
    mean: sum / sorted.length,
    median: at(0.5),
    p95: at(0.95),
    max: sorted[sorted.length - 1],
  };
}

interface RoomAccumulator {
  waitingSamples: number[];
  serviceSamples: number[];
  busyMs: number;
  patientsServed: number;
}

export class MetricsCollector {
  private patientsArrived = 0;
  private visitsCreated = 0;
  private visitsCompleted = 0;
  private noShows = 0;
  private qrScannedCount = 0;
  private serviceStartedCount = 0;
  private serviceEndCount = 0;

  private readonly createdAtByVisit = new Map<string, number>();
  private readonly queueJoinedAtByStep = new Map<number, number>();
  private readonly serviceStartedAtByStep = new Map<number, number>();

  private readonly waitingSamples: number[] = [];
  private readonly lengthOfStaySamples: number[] = [];
  private readonly serviceSamples: number[] = [];

  private readonly perRoom = new Map<number, RoomAccumulator>();

  private firstSimTimeMs: number | null = null;
  private lastSimTimeMs = 0;

  /** Gọi cho MỖI event đã dispatch, ĐÚNG THỨ TỰ simTimeMs — dùng làm
   * callback cho SimulationEngine.onEveryEvent(). An toàn gọi lại nhiều lần
   * (không có side-effect ngoài cập nhật state nội bộ của chính nó). */
  recordEvent(event: RecordableEvent): void {
    this.firstSimTimeMs ??= event.simTimeMs;
    this.lastSimTimeMs = Math.max(this.lastSimTimeMs, event.simTimeMs);

    switch (event.type) {
      case 'PATIENT_ARRIVED':
        this.patientsArrived += 1;
        break;

      case 'VISIT_CREATED':
        this.visitsCreated += 1;
        if (event.visitId) this.createdAtByVisit.set(event.visitId, event.simTimeMs);
        break;

      case 'PATIENT_NO_SHOW':
        this.noShows += 1;
        break;

      case 'QR_SCANNED':
        this.qrScannedCount += 1;
        if (event.visitStepId !== undefined) {
          this.queueJoinedAtByStep.set(event.visitStepId, event.simTimeMs);
        }
        break;

      case 'SERVICE_STARTED': {
        this.serviceStartedCount += 1;
        if (event.visitStepId !== undefined) {
          this.serviceStartedAtByStep.set(event.visitStepId, event.simTimeMs);
          const joinedAt = this.queueJoinedAtByStep.get(event.visitStepId);
          if (joinedAt !== undefined) {
            const waitMs = event.simTimeMs - joinedAt;
            this.waitingSamples.push(waitMs);
            if (event.roomId !== undefined) {
              this.roomBucket(event.roomId).waitingSamples.push(waitMs);
            }
          }
        }
        break;
      }

      case 'SERVICE_END': {
        this.serviceEndCount += 1;
        if (event.visitStepId !== undefined) {
          const startedAt = this.serviceStartedAtByStep.get(event.visitStepId);
          if (startedAt !== undefined) {
            const serviceMs = event.simTimeMs - startedAt;
            this.serviceSamples.push(serviceMs);
            if (event.roomId !== undefined) {
              const bucket = this.roomBucket(event.roomId);
              bucket.serviceSamples.push(serviceMs);
              bucket.busyMs += serviceMs;
              bucket.patientsServed += 1;
            }
          }
        }
        break;
      }

      case 'VISIT_COMPLETED': {
        this.visitsCompleted += 1;
        if (event.visitId) {
          const createdAt = this.createdAtByVisit.get(event.visitId);
          if (createdAt !== undefined) {
            this.lengthOfStaySamples.push(event.simTimeMs - createdAt);
          }
        }
        break;
      }

      default:
        // DOCTOR_POLL/CONTINUE_VISIT: điều phối nội bộ của actor, không
        // phải mốc đo lường — cố tình bỏ qua, không coi là lỗi.
        break;
    }
  }

  private roomBucket(roomId: number): RoomAccumulator {
    let bucket = this.perRoom.get(roomId);
    if (!bucket) {
      bucket = { waitingSamples: [], serviceSamples: [], busyMs: 0, patientsServed: 0 };
      this.perRoom.set(roomId, bucket);
    }
    return bucket;
  }

  snapshot(): MetricsSnapshot {
    const elapsedMs = this.firstSimTimeMs === null ? 0 : this.lastSimTimeMs - this.firstSimTimeMs;
    const elapsedHours = elapsedMs / 3_600_000;

    const perRoom: Record<number, RoomMetrics> = {};
    for (const [roomId, bucket] of this.perRoom) {
      perRoom[roomId] = {
        waitingTimeMs: summarize(bucket.waitingSamples),
        serviceTimeMs: summarize(bucket.serviceSamples),
        utilisationPct: elapsedMs > 0 ? Math.min(100, (bucket.busyMs / elapsedMs) * 100) : 0,
        patientsServed: bucket.patientsServed,
      };
    }

    return {
      simTimeMs: this.lastSimTimeMs,
      counters: {
        patientsArrived: this.patientsArrived,
        visitsCreated: this.visitsCreated,
        visitsCompleted: this.visitsCompleted,
        noShows: this.noShows,
        stepsWaiting: Math.max(0, this.qrScannedCount - this.serviceStartedCount),
        stepsInService: Math.max(0, this.serviceStartedCount - this.serviceEndCount),
      },
      waitingTimeMs: summarize(this.waitingSamples),
      lengthOfStayMs: summarize(this.lengthOfStaySamples),
      serviceTimeMs: summarize(this.serviceSamples),
      throughputPerSimHour: elapsedHours > 0 ? this.visitsCompleted / elapsedHours : 0,
      perRoom,
    };
  }
}