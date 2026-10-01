/**
 * Giả lập hành vi của 1 bệnh nhân thật (xem
 * docs/simulator-architecture.md §4 "Orchestrator and actors"). CHỈ gọi các
 * service production thật — VisitsService.create()/findDetailById() và
 * CheckInService.checkIn() — KHÔNG BAO GIỜ gọi thẳng RoutingEngineService.
 * Routing luôn được QUAN SÁT (đợi kết quả), không bao giờ bị KÍCH bởi actor
 * (§4.1 bảng "Routing | (none — triggered by the production event/cron)").
 *
 * "Chờ routing xong" (§4.1 dòng cuối) là bounded poll trên
 * VisitsService.findDetailById(). Hàng rào dừng ngay khi visit có active
 * assignment; các sibling chưa được chọn được phép giữ READY. Chỉ khi
 * cần phân biệt "đang retry" với "FAILED vĩnh viễn" actor mới đọc
 * RoutingQueue qua repository.
 */

import { VisitsService } from '../../visits/visits.service';
import { CheckInService } from '../../check-in/check-in.service';
import { RoutingQueueRepository } from '../../visits/repositories/routing-queue.repository';
import {
  SimulationEngine,
  SimulationEngineContext,
} from '../engine/simulation-engine';
import { PatientFlowEventType, PatientFlowPayload } from './patient-flow-events';

export type PatientFlowEngine = SimulationEngine<PatientFlowEventType, PatientFlowPayload>;
export type PatientFlowContext = SimulationEngineContext<PatientFlowEventType, PatientFlowPayload>;

export type SleepFn = (ms: number) => Promise<void>;
const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export interface PatientGeneratorConfig {
  /** SimulationRun sở hữu Visit tổng hợp — dùng để gắn routing decisions vào đúng run. */
  simulationRunId?: string;
  /** Xác suất bệnh nhân không bao giờ quét QR dù đã "tới nơi" (0..1). Mặc định 0. */
  noShowProbability?: number;
  /** Số lần tối đa poll findDetailById() để chờ routing xong cho 1 lượt gọi progressVisit(). Mặc định 40. */
  routingPollMaxAttempts?: number;
  /** Khoảng nghỉ THỰC (không phải sim-time) giữa 2 lần poll — ms thật. Mặc định 5ms. */
  routingPollIntervalMs?: number;
  /** Số lần retry routing tối đa để nhận biết entry FAILED đã thực sự terminal. */
  routingMaxRetryAttempts?: number;
  /** Khoảng chờ trong simulation time trước khi thử quan sát routing lại
   * nếu transaction routing hoàn thành chậm hơn cửa sổ polling thực. */
  routingRetryDelaySimMs?: number;
}

const DEFAULT_CONFIG: Required<Omit<PatientGeneratorConfig, 'simulationRunId'>> = {
  noShowProbability: 0,
  routingPollMaxAttempts: 40,
  routingPollIntervalMs: 5,
  routingMaxRetryAttempts: 5,
  routingRetryDelaySimMs: 1_000,
};

export class PatientGenerator {
  private readonly scheduledStepKeys = new Set<string>();
  private readonly pendingRoutingRetryVisitIds = new Set<string>();
  private readonly config: Required<Omit<PatientGeneratorConfig, 'simulationRunId'>> & {
    simulationRunId?: string;
  };

  constructor(
    private readonly visitsService: VisitsService,
    private readonly checkInService: CheckInService,
    private readonly roomIdToDeviceId: ReadonlyMap<number, string>,
    config: PatientGeneratorConfig,
    private readonly sleep: SleepFn = defaultSleep,
    private readonly routingQueueRepository?: Pick<
      RoutingQueueRepository,
      'findAllByVisitStepIds'
    >,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Đăng ký toàn bộ handler của actor này lên 1 engine dùng chung với DoctorSimulator. */
  register(engine: PatientFlowEngine): void {
    engine.on('PATIENT_ARRIVED', (event, ctx) => this.handlePatientArrived(event.payload, ctx));
    engine.on('CONTINUE_VISIT', (event, ctx) => this.handleContinueVisit(event, ctx));
    engine.on('WALK_COMPLETED', (event, ctx) => this.handleWalkCompleted(event, ctx));
    engine.on('QR_SCANNED', (event, ctx) => this.handleQrScanned(event, ctx));
  }

  private async handlePatientArrived(
    payload: PatientFlowPayload | undefined,
    ctx: PatientFlowContext,
  ): Promise<void> {
    if (!payload?.patientId || payload.flowId === undefined) {
      throw new Error(
        "PatientGenerator: PATIENT_ARRIVED cần payload { patientId, flowId } — thiếu khi lên lịch sự kiện này",
      );
    }
    const visit = this.config.simulationRunId
      ? await this.visitsService.create(
          payload.patientId,
          { flowId: payload.flowId },
          this.config.simulationRunId,
        )
      : await this.visitsService.create(payload.patientId, { flowId: payload.flowId });
    // [Phase 4] Sự kiện thuần ghi sổ — xem patient-flow-events.ts. Phát ngay
    // ở simTimeMs hiện tại (tạo Visit không tiêu tốn thời gian mô phỏng).
    ctx.schedule({ simTimeMs: ctx.now, type: 'VISIT_CREATED', visitId: visit.id });
    await this.progressVisit(ctx, visit.id);
  }

  private async handleContinueVisit(
    event: { visitId?: string },
    ctx: PatientFlowContext,
  ): Promise<void> {
    if (!event.visitId) return;
    this.pendingRoutingRetryVisitIds.delete(event.visitId);
    await this.progressVisit(ctx, event.visitId);
  }

  private async handleWalkCompleted(
    event: { visitId?: string; visitStepId?: number; roomId?: number; payload?: PatientFlowPayload },
    ctx: PatientFlowContext,
  ): Promise<void> {
    if (this.config.noShowProbability > 0 && ctx.rng.chance('no-show', this.config.noShowProbability)) {
      if (event.visitId === undefined || event.visitStepId === undefined) {
        throw new Error(
          'PatientGenerator: WALK_COMPLETED no-show cần visitId + visitStepId',
        );
      }
      await this.checkInService.cancelNoShow(event.visitId, event.visitStepId);
      ctx.schedule({
        simTimeMs: ctx.now,
        type: 'PATIENT_NO_SHOW',
        visitId: event.visitId,
        visitStepId: event.visitStepId,
        roomId: event.roomId,
      });
      return;
    }

    ctx.schedule({
      simTimeMs: ctx.now,
      type: 'QR_SCANNED',
      visitId: event.visitId,
      visitStepId: event.visitStepId,
      roomId: event.roomId,
      payload: event.payload,
    });
  }

  private async handleQrScanned(
    event: { visitId?: string; visitStepId?: number; roomId?: number; payload?: PatientFlowPayload },
    ctx: PatientFlowContext,
  ): Promise<void> {
    const roomId = event.roomId;
    const qrToken = event.payload?.qrToken;
    if (roomId === undefined || !qrToken) {
      throw new Error(
        'PatientGenerator: QR_SCANNED cần roomId + payload.qrToken — chỉ progressVisit() được phép lên lịch sự kiện này',
      );
    }
    const deviceId = this.roomIdToDeviceId.get(roomId);
    if (!deviceId) {
      // Scenario không cấp phát Device cho phòng này — bệnh nhân "cầm điện
      // thoại đứng trước cửa" nhưng không có gì để quét. Đây là 1 giới hạn
      // của SCENARIO (thiếu fixture), không phải lỗi của patient — không
      // coi là no-show, chỉ đơn giản là bệnh nhân kẹt ở bước này mãi mãi
      // trong lần chạy này, giống hệt cách hệ thống thật sẽ kẹt nếu quên
      // lắp máy quét QR cho 1 phòng đang hoạt động.
      return;
    }

    await this.checkInService.checkIn(deviceId, { token: qrToken });

    ctx.schedule({ simTimeMs: ctx.now, type: 'DOCTOR_POLL', roomId });
  }

  /**
   * Hàng rào chờ routing (§4.1) + lên lịch WALK_COMPLETED cho MỌI VisitStep
   * vừa ASSIGNED mà chưa từng được lên lịch đi tới (an toàn gọi lại nhiều
   * lần cho cùng 1 visit — chỉ những step CÒN ở đúng trạng thái ASSIGNED
   * mới được xử lý; step đã CHECKED_IN/IN_PROGRESS/COMPLETED sẽ bị bỏ qua
   * tự nhiên, không cần tự theo dõi thêm 1 tập "đã xử lý").
   */
  private async progressVisit(ctx: PatientFlowContext, visitId: string): Promise<void> {
    const { detail, retryNeeded } = await this.awaitRoutingSettled(visitId);

    for (const step of detail.steps) {
      if (step.status !== 'ASSIGNED' || !step.assignment) continue;
      const stepKey = `${visitId}:${step.id}`;
      if (this.scheduledStepKeys.has(stepKey)) continue;
      this.scheduledStepKeys.add(stepKey);

      ctx.schedule({
        // Không mô hình hoá walking time: giữ event để bảo toàn pipeline,
        // nhưng dispatch ngay trong cùng simulation tick.
        simTimeMs: ctx.now,
        type: 'WALK_COMPLETED',
        visitId,
        visitStepId: step.id,
        roomId: step.assignment.room.id,
        payload: step.assignment.qrToken ? { qrToken: step.assignment.qrToken } : undefined,
      });
    }

    if (detail.status === 'COMPLETED') {
      ctx.schedule({ simTimeMs: ctx.now, type: 'VISIT_COMPLETED', visitId });
    }

    // Routing is triggered asynchronously by the production event emitter.
    // Under DB load it can finish after the bounded real-time polling window.
    // Never abandon the visit in that gap: schedule one deduplicated retry in
    // simulation time so a late assignment still receives WALK/QR events.
    if (retryNeeded && !this.pendingRoutingRetryVisitIds.has(visitId)) {
      this.pendingRoutingRetryVisitIds.add(visitId);
      ctx.schedule({
        simTimeMs: ctx.now + this.config.routingRetryDelaySimMs,
        type: 'CONTINUE_VISIT',
        visitId,
      });
    }
  }

  /** Routing chỉ tạo MỘT active assignment cho visit. Các sibling READY
   * chưa được chọn phải ở nguyên READY, vì vậy chúng không thể là điều
   * kiện "chờ xong". Hàng rào trả về khi: (1) có active assignment,
   * (2) visit terminal, hoặc (3) không còn READY / mọi routing entry READY
   * đều FAILED vĩnh viễn. */
  private async awaitRoutingSettled(visitId: string) {
    for (let attempt = 0; attempt < this.config.routingPollMaxAttempts; attempt++) {
      const detail = await this.visitsService.findDetailById(visitId, null);
      if (detail.status === 'COMPLETED' || detail.status === 'CANCELLED') {
        return { detail, retryNeeded: false };
      }

      const hasActiveAssignment = detail.steps.some(
        (step) =>
          step.assignment !== null &&
          ['ASSIGNED', 'CHECKED_IN', 'IN_PROGRESS'].includes(step.status),
      );
      if (hasActiveAssignment) return { detail, retryNeeded: false };

      const readyStepIds = detail.steps
        .filter((step) => step.status === 'READY')
        .map((step) => step.id);
      if (readyStepIds.length === 0) return { detail, retryNeeded: false };

      if (this.routingQueueRepository) {
        const entries = await this.routingQueueRepository.findAllByVisitStepIds(
          readyStepIds,
        );
        const entriesByStepId = new Map(
          entries.map((entry) => [entry.visitStepId, entry]),
        );
        const everyReadyEntryTerminal = readyStepIds.every((stepId) => {
          const entry = entriesByStepId.get(stepId);
          return (
            entry?.status === 'FAILED' &&
            entry.retryCount >= this.config.routingMaxRetryAttempts
          );
        });

        // Một entry có thể vừa bị routing worker xóa trong transaction gán phòng,
        // trong khi lần đọc Visit ngay trước đó vẫn còn thấy step READY. Trạng thái
        // thiếu entry vì thế là "đang chuyển tiếp", không phải thất bại vĩnh viễn.
        if (everyReadyEntryTerminal) return { detail, retryNeeded: false };
      }
      await this.sleep(this.config.routingPollIntervalMs);
    }
    const detail = await this.visitsService.findDetailById(visitId, null);
    const terminal = detail.status === 'COMPLETED' || detail.status === 'CANCELLED';
    const hasActiveAssignment = detail.steps.some(
      (step) =>
        step.assignment !== null &&
        ['ASSIGNED', 'CHECKED_IN', 'IN_PROGRESS'].includes(step.status),
    );
    const hasReadyStep = detail.steps.some((step) => step.status === 'READY');
    return {
      detail,
      retryNeeded: !terminal && !hasActiveAssignment && hasReadyStep,
    };
  }
}
