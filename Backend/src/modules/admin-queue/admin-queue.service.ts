import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AssignmentStatus } from "@prisma/client";
import { RoomQueueEntriesRepository } from "../check-in/repositories/room-queue-entries.repository";
import { ActivityLogService } from "../activity-log/activity-log.service";
import { AdminQueueEntryDto } from "./dto/admin-queue-entry.dto";
import {
  ROOM_QUEUE_UPDATED_EVENT,
  RoomQueueUpdatedEvent,
} from "../check-in/events/room-queue-updated.event";

@Injectable()
export class AdminQueueService {
  constructor(
    private readonly roomQueueEntriesRepository: RoomQueueEntriesRepository,
    private readonly activityLogService: ActivityLogService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** §3 "Xem hàng đợi thời gian thực tại từng phòng khám" — toàn viện, không lọc theo phòng nào */
  async getFullQueueOverview(): Promise<AdminQueueEntryDto[]> {
    const entries = await this.roomQueueEntriesRepository.findAllWithDetails();

    return entries.map((entry) => ({
      queueEntryId: entry.id,
      position: entry.position,
      source: entry.source,
      visitAssignmentId: entry.visitAssignmentId,
      visitStepId: entry.visitAssignment.visitStep.id,
      // [SỬA] Thêm status — cho phép FE tách "đang chờ" (WAITING/CHECKED_IN)
      // khỏi "đang được khám" (IN_PROGRESS) từ CÙNG 1 danh sách, không cần
      // gọi thêm API nào khác.
      status: entry.visitAssignment.status,
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

  /**
   * §3 "Can thiệp thủ công trong trường hợp đặc biệt (ví dụ cấp cứu)" —
   * đưa 1 bệnh nhân lên đầu hàng đợi của đúng phòng nó đang chờ.
   */
  async moveToFront(adminUserId: string, queueEntryId: number): Promise<void> {
    const entry = await this.roomQueueEntriesRepository.findByIdWithAssignment(queueEntryId);
    if (!entry) {
      throw new NotFoundException(`RoomQueueEntry #${queueEntryId} không tồn tại`);
    }
    this.assertCanReorder(entry.visitAssignment.status);

    const minPosition = await this.roomQueueEntriesRepository.getMinPosition(
      entry.roomId,
    );
    const newPosition = (minPosition ?? entry.position) - 1;
    const oldPosition = entry.position;

    await this.roomQueueEntriesRepository.updatePosition(queueEntryId, newPosition);

    await this.logAndBroadcast(adminUserId, "ROOM_QUEUE_MOVE_TO_FRONT", entry.roomId, {
      queueEntryId,
      oldPosition,
      newPosition,
    });
  }

  /**
   * Chèn 1 entry vào NGAY SAU 1 entry khác trong cùng phòng — dùng
   * fractional ordering (lấy trung điểm giữa 2 vị trí lân cận).
   */
  async moveAfter(
    adminUserId: string,
    queueEntryId: number,
    targetQueueEntryId: number,
  ): Promise<void> {
    if (queueEntryId === targetQueueEntryId) {
      throw new BadRequestException("Không thể chèn 1 entry ngay sau chính nó");
    }

    const [entry, target] = await Promise.all([
      this.roomQueueEntriesRepository.findByIdWithAssignment(queueEntryId),
      this.roomQueueEntriesRepository.findByIdWithAssignment(targetQueueEntryId),
    ]);
    if (!entry) {
      throw new NotFoundException(`RoomQueueEntry #${queueEntryId} không tồn tại`);
    }
    if (!target) {
      throw new NotFoundException(`RoomQueueEntry #${targetQueueEntryId} không tồn tại`);
    }
    this.assertCanReorder(entry.visitAssignment.status);
    if (entry.roomId !== target.roomId) {
      throw new BadRequestException("2 entry phải cùng thuộc 1 phòng khám");
    }

    const nextEntry = await this.roomQueueEntriesRepository.findNextAfter(
      target.roomId,
      target.position,
    );
    const newPosition = nextEntry
      ? (target.position + nextEntry.position) / 2
      : target.position + 1;
    const oldPosition = entry.position;

    await this.roomQueueEntriesRepository.updatePosition(queueEntryId, newPosition);

    await this.logAndBroadcast(adminUserId, "ROOM_QUEUE_MOVE_AFTER", entry.roomId, {
      queueEntryId,
      oldPosition,
      newPosition,
      afterQueueEntryId: targetQueueEntryId,
    });
  }

  private assertCanReorder(status: AssignmentStatus): void {
    if (status === AssignmentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        "Không thể đổi vị trí bệnh nhân đang được khám",
      );
    }
    if (
      status === AssignmentStatus.COMPLETED ||
      status === AssignmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        "Không thể đổi vị trí bệnh nhân đã rời hàng đợi",
      );
    }
  }

  private async logAndBroadcast(
    adminUserId: string,
    action: string,
    roomId: number,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.activityLogService.log({
      userId: adminUserId,
      action,
      entity: "RoomQueueEntry",
      entityId: String(metadata.queueEntryId),
      metadata: { roomId, ...metadata },
    });

    this.eventEmitter.emit(ROOM_QUEUE_UPDATED_EVENT, new RoomQueueUpdatedEvent(roomId));
  }
}
