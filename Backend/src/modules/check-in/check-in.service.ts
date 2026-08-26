import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssignmentStatus, QueueEntrySource, VisitStepStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DevicesRepository } from '../devices/devices.repository';
import { VisitTokensRepository } from '../routing/repositories/visit-tokens.repository';
import { VisitAssignmentsRepository } from '../routing/repositories/visit-assignments.repository';
import { VisitStepsRepository } from '../visits/repositories/visit-steps.repository';
import { RoomQueueEntriesRepository } from './repositories/room-queue-entries.repository';
import { CheckInLogsRepository } from './repositories/check-in-logs.repository';
import { CheckInDto } from './dto/check-in.dto';
import { CheckInResponseDto } from './dto/check-in-response.dto';
import { VISIT_UPDATED_EVENT, VisitUpdatedEvent } from '../visits/events/visit-updated.event';
import {
  ROOM_QUEUE_UPDATED_EVENT,
  RoomQueueUpdatedEvent,
} from './events/room-queue-updated.event';

@Injectable()
export class CheckInService {
  constructor(
    private readonly devicesRepository: DevicesRepository,
    private readonly visitTokensRepository: VisitTokensRepository,
    private readonly visitAssignmentsRepository: VisitAssignmentsRepository,
    private readonly visitStepsRepository: VisitStepsRepository,
    private readonly roomQueueEntriesRepository: RoomQueueEntriesRepository,
    private readonly checkInLogsRepository: CheckInLogsRepository,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Hiện thực §9 của spec — 4 điều kiện bắt buộc:
   *  1. QR còn hiệu lực (chưa hết hạn)
   *  2. QR chưa được sử dụng
   *  3. Thiết bị thuộc đúng phòng khám được chỉ định
   *  4. Bệnh nhân đang ở đúng bước khám (VisitStep.status = ASSIGNED)
   * Mọi lần quét (kể cả thất bại) đều ghi CheckInLog để audit — TRỪ trường
   * hợp token hoàn toàn không tồn tại (không có visitAssignmentId hợp lệ để
   * gắn log — CheckInLog.visitAssignmentId là bắt buộc trong schema).
   */
  async checkIn(deviceId: string, dto: CheckInDto): Promise<CheckInResponseDto> {
    const device = await this.devicesRepository.findById(deviceId);
    if (!device) {
      throw new ForbiddenException('Thiết bị không tồn tại');
    }

    const visitToken = await this.visitTokensRepository.findByToken(dto.token);
    if (!visitToken) {
      // Không có visitAssignmentId để log — token rác/không tồn tại, bỏ qua audit
      throw new NotFoundException('Mã QR không tồn tại');
    }

    const assignment = await this.visitAssignmentsRepository.findById(
      visitToken.visitAssignmentId,
    );
    if (!assignment) {
      throw new NotFoundException('Không tìm thấy dữ liệu phân công tương ứng với mã QR này');
    }

    const logFailure = (errorMessage: string) =>
      this.checkInLogsRepository.create({
        visitAssignment: { connect: { id: assignment.id } },
        device: { connect: { id: deviceId } },
        success: false,
        errorMessage,
      });

    // Điều kiện 1+2: còn hạn + chưa dùng
    if (visitToken.usedAt) {
      await logFailure('QR đã được sử dụng trước đó');
      throw new ConflictException('Mã QR đã được sử dụng');
    }
    if (visitToken.expiresAt < new Date()) {
      await logFailure('QR đã hết hạn');
      throw new ConflictException('Mã QR đã hết hạn');
    }

    // Điều kiện 3: đúng phòng
    if (assignment.roomId !== device.roomId) {
      await logFailure(
        `Thiết bị thuộc phòng #${device.roomId}, không khớp phòng được chỉ định #${assignment.roomId}`,
      );
      throw new ForbiddenException(
        'Thiết bị không thuộc đúng phòng khám được chỉ định cho bệnh nhân này',
      );
    }
    if (assignment.status !== AssignmentStatus.WAITING) {
      await logFailure(`VisitAssignment đang ở trạng thái ${assignment.status}, không hợp lệ để check-in`);
      throw new ConflictException('Lượt khám này không ở trạng thái chờ check-in');
    }

    // Điều kiện 4: đúng bước khám
    const visitStep = await this.visitStepsRepository.findById(assignment.visitStepId);
    if (!visitStep || visitStep.status !== VisitStepStatus.ASSIGNED) {
      await logFailure('VisitStep không ở trạng thái ASSIGNED — không đúng bước khám hiện tại');
      throw new ConflictException('Bệnh nhân hiện không ở đúng bước khám để check-in');
    }

    // Hợp lệ toàn bộ — ghi nhận check-in trong 1 transaction (Unit of Work)
    const queuePosition = await this.prisma.transaction(async (tx) => {
      await this.visitTokensRepository.markUsed(visitToken.id, tx);
      await this.visitAssignmentsRepository.updateStatus(
        assignment.id,
        AssignmentStatus.CHECKED_IN,
        { checkedInAt: new Date() },
        tx,
      );
      await this.visitStepsRepository.updateStatus(
        visitStep.id,
        VisitStepStatus.CHECKED_IN,
        {},
        tx,
      );

      const position = await this.roomQueueEntriesRepository.getNextPosition(
        assignment.roomId,
        tx,
      );
      await this.roomQueueEntriesRepository.create(
        {
          room: { connect: { id: assignment.roomId } },
          visitAssignment: { connect: { id: assignment.id } },
          position,
          source: QueueEntrySource.AUTO_CHECKIN,
        },
        tx,
      );

      await this.checkInLogsRepository.create(
        {
          visitAssignment: { connect: { id: assignment.id } },
          device: { connect: { id: deviceId } },
          success: true,
        },
        tx,
      );

      return position;
    });

    // Bump heartbeat — ngoài transaction vì không liên quan tới nghiệp vụ check-in
    await this.devicesRepository.update(deviceId, { lastHeartbeatAt: new Date() });

    // [Phase 9] Patient thấy status đổi CHECKED_IN; Doctor/Admin thấy hàng đợi phòng vừa có thêm người
    this.eventEmitter.emit(VISIT_UPDATED_EVENT, new VisitUpdatedEvent(visitStep.visitId));
    this.eventEmitter.emit(
      ROOM_QUEUE_UPDATED_EVENT,
      new RoomQueueUpdatedEvent(assignment.roomId),
    );

    return {
      visitStepId: visitStep.id,
      status: VisitStepStatus.CHECKED_IN,
      roomId: assignment.roomId,
      queuePosition,
    };
  }
}
