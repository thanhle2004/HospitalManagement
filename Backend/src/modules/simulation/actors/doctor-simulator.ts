/**
 * Giả lập hành vi của 1 bác sĩ thật (xem
 * docs/simulator-architecture.md §4). CHỈ gọi DoctorService.getMyQueue()/
 * startExam()/completeExam() — cùng 3 method mà DoctorController thật expose
 * cho ứng dụng bác sĩ dùng, không có đường tắt nào khác.
 *
 * KHÔNG polling định kỳ (xem lý do trong patient-flow-events.ts) — mỗi
 * DOCTOR_POLL đều được 1 sự kiện khác kích lên đúng lúc có việc mới: ngay
 * sau QR_SCANNED (PatientGenerator) hoặc ngay sau SERVICE_END của CHÍNH
 * phòng đó (handleServiceEnd bên dưới tự lên lịch lại DOCTOR_POLL 1 lần).
 * Nhờ vậy chuỗi sự kiện luôn hữu hạn — không có gì tự lặp lại vô căn cứ,
 * SimulationEngine LOCKSTEP vẫn rỗng hàng đợi và COMPLETED khi hết việc.
 */

import { AssignmentStatus } from '@prisma/client';
import { DoctorService } from '../../doctor/doctor.service';
import { VisitStepsRepository } from '../../visits/repositories/visit-steps.repository';
import {
  SimulationEngineContext,
} from '../engine/simulation-engine';
import { PatientFlowEventType, PatientFlowPayload } from './patient-flow-events';
import { PatientFlowEngine } from './patient-generator';

export type DoctorFlowContext = SimulationEngineContext<PatientFlowEventType, PatientFlowPayload>;

export interface RoomServiceTimeConfig {
  /** Thời lượng khám trung bình — giây nghiệp vụ. */
  meanSeconds: number;
  /** Bỏ trống = FIXED. Có giá trị = lấy mẫu phân phối chuẩn
   * quanh meanSeconds (kẹp về 0), vẫn trong miền giây. */
  stdDevSeconds?: number;
}

const DEFAULT_SERVICE_TIME: RoomServiceTimeConfig = { meanSeconds: 15 };

export class DoctorSimulator {
  constructor(
    private readonly doctorService: DoctorService,
    private readonly visitStepsRepository: VisitStepsRepository,
    private readonly roomIdToDoctorId: ReadonlyMap<number, string>,
    private readonly serviceTimeByRoom: ReadonlyMap<number, RoomServiceTimeConfig> = new Map(),
  ) {}

  register(engine: PatientFlowEngine): void {
    engine.on('DOCTOR_POLL', (event, ctx) => this.handleDoctorPoll(event, ctx));
    engine.on('SERVICE_END', (event, ctx) => this.handleServiceEnd(event, ctx));
  }

  private async handleDoctorPoll(
    event: { roomId?: number },
    ctx: DoctorFlowContext,
  ): Promise<void> {
    const roomId = event.roomId;
    if (roomId === undefined) return;

    const doctorId = this.roomIdToDoctorId.get(roomId);
    if (!doctorId) {
      // Scenario này không cấp bác sĩ cho phòng — bệnh nhân chờ vô thời hạn
      // trong lần chạy này, đúng như hệ thống thật sẽ chờ nếu không ai trực
      // (chính là Scenario 6 "Doctor leaves room" trong docs/simulator-architecture.md §12).
      return;
    }

    const queue = await this.doctorService.getMyQueue(doctorId);
    const roomQueue = queue
      .filter((entry) => entry.room.id === roomId)
      .sort((a, b) => a.position - b.position);
    if (roomQueue.length === 0) return;

    const alreadyBusy = roomQueue.some(
      (entry) => entry.status === AssignmentStatus.IN_PROGRESS,
    );
    if (alreadyBusy) return; // ai đó khác đã/đang chiếm phòng — SERVICE_END của họ sẽ tự kích DOCTOR_POLL tiếp theo

    const head = roomQueue[0];
    if (head.status !== AssignmentStatus.CHECKED_IN) return; // phòng vệ — trạng thái không như kỳ vọng, không đoán bừa

    await this.doctorService.startExam(doctorId, head.visitAssignmentId);

    // [Phase 4] Sự kiện thuần ghi sổ — xem patient-flow-events.ts.
    ctx.schedule({
      simTimeMs: ctx.now,
      type: 'SERVICE_STARTED',
      roomId,
      visitStepId: head.visitStepId,
      payload: { doctorId, assignmentId: head.visitAssignmentId },
    });

    const serviceSeconds = this.sampleServiceTimeSeconds(ctx, roomId);
    ctx.schedule({
      // Ranh giới duy nhất chuyển giây nghiệp vụ sang ms của scheduler.
      simTimeMs: ctx.now + Math.round(serviceSeconds * 1000),
      type: 'SERVICE_END',
      roomId,
      visitStepId: head.visitStepId,
      payload: { doctorId, assignmentId: head.visitAssignmentId },
    });
  }

  private async handleServiceEnd(
    event: { roomId?: number; visitStepId?: number; payload?: PatientFlowPayload },
    ctx: DoctorFlowContext,
  ): Promise<void> {
    const doctorId = event.payload?.doctorId;
    const assignmentId = event.payload?.assignmentId;
    if (!doctorId || assignmentId === undefined) {
      throw new Error(
        'DoctorSimulator: SERVICE_END cần payload { doctorId, assignmentId } — chỉ handleDoctorPoll() được phép lên lịch sự kiện này',
      );
    }

    await this.doctorService.completeExam(doctorId, assignmentId);

    // completeExam() không trả về visitId trong ExamActionResponseDto — tra
    // lại qua VisitStep để biết cần "tiếp tục" (CONTINUE_VISIT) cho Visit nào.
    if (event.visitStepId !== undefined) {
      const step = await this.visitStepsRepository.findById(event.visitStepId);
      if (step) {
        ctx.schedule({ simTimeMs: ctx.now, type: 'CONTINUE_VISIT', visitId: step.visitId });
      }
    }

    if (event.roomId !== undefined) {
      ctx.schedule({ simTimeMs: ctx.now, type: 'DOCTOR_POLL', roomId: event.roomId });
    }
  }

  private sampleServiceTimeSeconds(ctx: DoctorFlowContext, roomId: number): number {
    const cfg = this.serviceTimeByRoom.get(roomId) ?? DEFAULT_SERVICE_TIME;
    if (!cfg.stdDevSeconds) return cfg.meanSeconds;
    return Math.max(
      0,
      ctx.rng.normal(`service-time:${roomId}`, cfg.meanSeconds, cfg.stdDevSeconds),
    );
  }
}
