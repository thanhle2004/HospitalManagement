import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AssignmentStatus, VisitStepStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitStepsRepository } from '../visits/repositories/visit-steps.repository';
import { RoutingQueueRepository } from '../visits/repositories/routing-queue.repository';
import { RoomsRepository } from '../rooms/rooms.repository';
import { RoomTypesRepository } from '../room-types/room-types.repository';
import { VisitAssignmentsRepository } from './repositories/visit-assignments.repository';
import { VisitTokensRepository } from './repositories/visit-tokens.repository';
import { generateQrToken } from './utils/generate-qr-token.util';
import {
  VISIT_STEP_READY_EVENT,
  VisitStepReadyEvent,
} from '../visits/events/visit-step-ready.event';
import { VISIT_UPDATED_EVENT, VisitUpdatedEvent } from '../visits/events/visit-updated.event';

/** Ném ra khi 1 tiến trình routing khác đã "claim" step này trước — coi là no-op, không phải lỗi thật */
class AlreadyClaimedError extends Error {}

@Injectable()
export class RoutingEngineService {
  private readonly logger = new Logger(RoutingEngineService.name);

  constructor(
    private readonly visitStepsRepository: VisitStepsRepository,
    private readonly routingQueueRepository: RoutingQueueRepository,
    private readonly roomsRepository: RoomsRepository,
    private readonly roomTypesRepository: RoomTypesRepository,
    private readonly visitAssignmentsRepository: VisitAssignmentsRepository,
    private readonly visitTokensRepository: VisitTokensRepository,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Trigger tức thời ngay khi VisitsService xác định 1 step vừa READY — không cần chờ cron */
  @OnEvent(VISIT_STEP_READY_EVENT)
  async handleVisitStepReady(event: VisitStepReadyEvent): Promise<void> {
    await this.assignRoom(event.visitStepId);
  }

  /** Lưới an toàn: retry các step PENDING/FAILED (chưa vượt quá số lần thử) mỗi 10 giây */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPendingQueue(): Promise<{ processed: number }> {
    const maxAttempts = this.configService.get<number>(
      'routing.maxRetryAttempts',
    )!;
    const pending = await this.routingQueueRepository.findPending(maxAttempts);

    for (const entry of pending) {
      await this.assignRoom(entry.visitStepId);
    }

    return { processed: pending.length };
  }

  /**
   * Hiện thực §8 của spec — Routing Engine:
   *  Bước 2 (đã làm ở Phase 5): step này đã ở trạng thái READY
   *  Bước 3: lấy các Room ACTIVE thuộc đúng RoomType
   *  Bước 4: ETA = (đang chờ + đang khám) * avgProcessTime mỗi phòng
   *  Bước 5: chọn phòng ETA nhỏ nhất (Greedy), tie-break bằng sortOrder
   *  Bước 6: sinh VisitAssignment + VisitToken (QR)
   */
  async assignRoom(visitStepId: number): Promise<void> {
    const step = await this.visitStepsRepository.findById(visitStepId);
    if (!step || step.status !== VisitStepStatus.READY) {
      // Đã được xử lý bởi lần gọi khác (event + cron trùng thời điểm) hoặc
      // step đã bị huỷ — dọn hàng đợi, không coi là lỗi.
      await this.safeRemoveFromQueue(visitStepId);
      return;
    }

    const [roomType, activeRooms] = await Promise.all([
      this.roomTypesRepository.findById(step.roomTypeId),
      this.roomsRepository.findActiveByRoomType(step.roomTypeId),
    ]);

    if (!roomType || activeRooms.length === 0) {
      this.logger.warn(
        `VisitStep #${visitStepId}: không có Room ACTIVE nào thuộc RoomType #${step.roomTypeId}`,
      );
      await this.routingQueueRepository.markFailed(
        visitStepId,
        `Không có phòng ACTIVE nào thuộc RoomType #${step.roomTypeId} — Admin cần kiểm tra lại`,
      );
      return;
    }

    const candidates = await Promise.all(
      activeRooms.map(async (room) => ({
        room,
        eta:
          (await this.visitAssignmentsRepository.countActiveByRoom(room.id)) *
          roomType.avgProcessTime,
      })),
    );
    // Greedy: ETA nhỏ nhất thắng; bằng ETA thì ưu tiên sortOrder nhỏ hơn (§11.5)
    candidates.sort((a, b) => a.eta - b.eta || a.room.sortOrder - b.room.sortOrder);
    const chosenRoom = candidates[0].room;

    try {
      await this.prisma.transaction(async (tx) => {
        // "Claim" nguyên tử: chỉ chuyển READY -> ASSIGNED nếu status VẪN
        // còn là READY tại thời điểm ghi — đây chính là cơ chế chống race
        // (tương đương optimistic lock, dùng VisitStepStatus làm "version").
        const claim = await tx.visitStep.updateMany({
          where: { id: visitStepId, status: VisitStepStatus.READY },
          data: { status: VisitStepStatus.ASSIGNED },
        });
        if (claim.count === 0) {
          throw new AlreadyClaimedError();
        }

        const assignment = await this.visitAssignmentsRepository.create(
          {
            visitStep: { connect: { id: visitStepId } },
            room: { connect: { id: chosenRoom.id } },
            status: AssignmentStatus.WAITING,
          },
          tx,
        );

        const qrExpiresInSeconds = this.configService.get<number>(
          'routing.qrExpiresInSeconds',
        )!;
        await this.visitTokensRepository.create(
          {
            visitAssignment: { connect: { id: assignment.id } },
            token: generateQrToken(),
            expiresAt: new Date(Date.now() + qrExpiresInSeconds * 1000),
          },
          tx,
        );

        await this.routingQueueRepository.delete(visitStepId, tx);
      });

      this.logger.log(
        `VisitStep #${visitStepId} -> Room #${chosenRoom.id} (${chosenRoom.roomNumber}), ETA=${candidates[0].eta}`,
      );

      // [Phase 9] Báo Patient qua WebSocket: đã có phòng + QR
      this.eventEmitter.emit(VISIT_UPDATED_EVENT, new VisitUpdatedEvent(step.visitId));
    } catch (err) {
      if (err instanceof AlreadyClaimedError) {
        await this.safeRemoveFromQueue(visitStepId);
        return;
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Routing thất bại cho VisitStep #${visitStepId}: ${message}`);
      await this.routingQueueRepository.markFailed(visitStepId, message);
    }
  }

  private async safeRemoveFromQueue(visitStepId: number): Promise<void> {
    try {
      await this.routingQueueRepository.delete(visitStepId);
    } catch {
      // Row có thể đã bị xoá bởi 1 lần xử lý khác — bỏ qua, không phải lỗi
    }
  }
}
