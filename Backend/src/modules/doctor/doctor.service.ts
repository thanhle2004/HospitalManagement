import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssignmentStatus, VisitStepStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DoctorAssignmentsRepository } from '../doctor-assignments/repositories/doctor-assignments.repository';
import { VisitAssignmentsRepository } from '../routing/repositories/visit-assignments.repository';
import { RoomQueueEntriesRepository } from '../check-in/repositories/room-queue-entries.repository';
import { RoomRuntimeRepository } from '../rooms/room-runtime.repository';
import { VisitStepsRepository } from '../visits/repositories/visit-steps.repository';
import { VisitsService } from '../visits/visits.service';
import { DoctorQueueEntryDto } from './dto/doctor-queue-entry.dto';
import { ExamActionResponseDto } from './dto/exam-action-response.dto';
import {
  VISIT_STEP_READY_EVENT,
  VisitStepReadyEvent,
} from '../visits/events/visit-step-ready.event';
import { VISIT_UPDATED_EVENT, VisitUpdatedEvent } from '../visits/events/visit-updated.event';
import {
  ROOM_QUEUE_UPDATED_EVENT,
  RoomQueueUpdatedEvent,
} from '../check-in/events/room-queue-updated.event';

/** Ném ra khi optimistic lock trên RoomRuntime bị conflict — báo hiệu cần retry, không phải lỗi nghiệp vụ */
class OptimisticLockConflictError extends Error {}

const MAX_LOCK_RETRY_ATTEMPTS = 3;

@Injectable()
export class DoctorService {
  constructor(
    private readonly doctorAssignmentsRepository: DoctorAssignmentsRepository,
    private readonly visitAssignmentsRepository: VisitAssignmentsRepository,
    private readonly roomQueueEntriesRepository: RoomQueueEntriesRepository,
    private readonly roomRuntimeRepository: RoomRuntimeRepository,
    private readonly visitStepsRepository: VisitStepsRepository,
    private readonly visitsService: VisitsService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** §4 "Xem danh sách bệnh nhân đang chờ tại phòng khám được phân công" */
  async getMyQueue(doctorId: string): Promise<DoctorQueueEntryDto[]> {
    const roomIds = await this.doctorAssignmentsRepository.findActiveRoomIdsForDoctor(
      doctorId,
    );
    const entries = await this.roomQueueEntriesRepository.findAllByRoomsWithDetails(
      roomIds,
    );

    return entries.map((entry) => ({
      queueEntryId: entry.id,
      position: entry.position,
      visitAssignmentId: entry.visitAssignmentId,
      visitStepId: entry.visitAssignment.visitStep.id,
      room: {
        id: entry.room.id,
        roomNumber: entry.room.roomNumber,
        name: entry.room.name,
      },
      roomType: {
        id: entry.visitAssignment.visitStep.roomType.id,
        name: entry.visitAssignment.visitStep.roomType.name,
      },
      patient: {
        id: entry.visitAssignment.visitStep.visit.patient.id,
        fullName: entry.visitAssignment.visitStep.visit.patient.fullName,
        phone: entry.visitAssignment.visitStep.visit.patient.phone,
      },
      checkedInAt: entry.visitAssignment.checkedInAt,
    }));
  }

  /** §4 "Bắt đầu ... quá trình khám bệnh" */
  async startExam(
    doctorId: string,
    visitAssignmentId: number,
  ): Promise<ExamActionResponseDto> {
    const assignment = await this.visitAssignmentsRepository.findByIdWithStep(
      visitAssignmentId,
    );
    if (!assignment) {
      throw new NotFoundException(`VisitAssignment #${visitAssignmentId} không tồn tại`);
    }
    if (assignment.status !== AssignmentStatus.CHECKED_IN) {
      throw new ConflictException(
        `Assignment đang ở trạng thái ${assignment.status}, phải là CHECKED_IN mới bắt đầu khám được`,
      );
    }

    await this.assertDoctorOnDutyAtRoom(doctorId, assignment.roomId);
    await this.roomRuntimeRepository.ensureExists(assignment.roomId);

    for (let attempt = 0; attempt < MAX_LOCK_RETRY_ATTEMPTS; attempt++) {
      const runtime = await this.roomRuntimeRepository.findByRoomId(assignment.roomId);
      if (runtime?.currentVisitAssignmentId) {
        throw new ConflictException(
          'Phòng đang khám 1 bệnh nhân khác — hoàn thành ca đó trước',
        );
      }

      try {
        await this.prisma.transaction(async (tx) => {
          const claimed = await this.roomRuntimeRepository.trySetCurrentAssignment(
            assignment.roomId,
            visitAssignmentId,
            runtime!.version,
            tx,
          );
          if (!claimed) {
            throw new OptimisticLockConflictError();
          }

          await this.visitAssignmentsRepository.updateStatus(
            visitAssignmentId,
            AssignmentStatus.IN_PROGRESS,
            { startedAt: new Date(), doctorId },
            tx,
          );
          await this.visitStepsRepository.updateStatus(
            assignment.visitStep.id,
            VisitStepStatus.IN_PROGRESS,
            {},
            tx,
          );
        });

        // [Phase 9] Patient/Doctor thấy status đổi IN_PROGRESS qua WebSocket
        this.eventEmitter.emit(
          VISIT_UPDATED_EVENT,
          new VisitUpdatedEvent(assignment.visitStep.visitId),
        );

        return { visitAssignmentId, status: AssignmentStatus.IN_PROGRESS };
      } catch (err) {
        if (err instanceof OptimisticLockConflictError) {
          continue; // phòng vừa bị 1 tiến trình khác claim — thử lại
        }
        throw err;
      }
    }

    throw new ConflictException(
      'Không thể bắt đầu khám do xung đột đồng thời — vui lòng thử lại',
    );
  }

  /**
   * §4 "... và kết thúc quá trình khám bệnh". Sau khi hoàn thành, tự động
   * chạy lại dependency resolution (§7 Bước 8) để mở khoá các bước kế tiếp.
   */
  async completeExam(
    doctorId: string,
    visitAssignmentId: number,
  ): Promise<ExamActionResponseDto> {
    const assignment = await this.visitAssignmentsRepository.findByIdWithStep(
      visitAssignmentId,
    );
    if (!assignment) {
      throw new NotFoundException(`VisitAssignment #${visitAssignmentId} không tồn tại`);
    }
    if (assignment.status !== AssignmentStatus.IN_PROGRESS) {
      throw new ConflictException(
        `Assignment đang ở trạng thái ${assignment.status}, phải là IN_PROGRESS mới hoàn thành được`,
      );
    }

    await this.assertDoctorOnDutyAtRoom(doctorId, assignment.roomId);

    const readyStepIds = await this.prisma.transaction(async (tx) => {
      const now = new Date();

      await this.visitAssignmentsRepository.updateStatus(
        visitAssignmentId,
        AssignmentStatus.COMPLETED,
        { completedAt: now },
        tx,
      );
      await this.visitStepsRepository.updateStatus(
        assignment.visitStep.id,
        VisitStepStatus.COMPLETED,
        { completedAt: now },
        tx,
      );
      await this.roomQueueEntriesRepository.deleteByVisitAssignment(
        visitAssignmentId,
        tx,
      );

      // Giải phóng RoomRuntime — chỉ clear nếu đúng assignment này đang chiếm giữ
      const runtime = await this.roomRuntimeRepository.findByRoomId(
        assignment.roomId,
        tx,
      );
      if (runtime?.currentVisitAssignmentId === visitAssignmentId) {
        await this.roomRuntimeRepository.trySetCurrentAssignment(
          assignment.roomId,
          null,
          runtime.version,
          tx,
        );
      }

      return this.visitsService.resolveDependenciesAndCheckCompletion(
        assignment.visitStep.visitId,
        tx,
      );
    });

    for (const stepId of readyStepIds) {
      this.eventEmitter.emit(VISIT_STEP_READY_EVENT, new VisitStepReadyEvent(stepId));
    }
    this.eventEmitter.emit(
      VISIT_UPDATED_EVENT,
      new VisitUpdatedEvent(assignment.visitStep.visitId),
    );
    this.eventEmitter.emit(
      ROOM_QUEUE_UPDATED_EVENT,
      new RoomQueueUpdatedEvent(assignment.roomId),
    );

    return { visitAssignmentId, status: AssignmentStatus.COMPLETED };
  }

  private async assertDoctorOnDutyAtRoom(doctorId: string, roomId: number): Promise<void> {
    const activeRoomIds = await this.doctorAssignmentsRepository.findActiveRoomIdsForDoctor(
      doctorId,
    );
    if (!activeRoomIds.includes(roomId)) {
      throw new ForbiddenException('Bạn không đang trực tại phòng khám này');
    }
  }
}
