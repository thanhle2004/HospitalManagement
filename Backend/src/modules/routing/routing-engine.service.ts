import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AssignmentStatus, Prisma, VisitStatus, VisitStepStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitStepsRepository } from '../visits/repositories/visit-steps.repository';
import { RoutingQueueRepository } from '../visits/repositories/routing-queue.repository';
import { VisitsRepository } from '../visits/repositories/visits.repository';
import { RoomsRepository } from '../rooms/rooms.repository';
import { RoomTypesRepository } from '../room-types/room-types.repository';
import { VisitAssignmentsRepository } from './repositories/visit-assignments.repository';
import { VisitTokensRepository } from './repositories/visit-tokens.repository';
import { RoutingDecisionsRepository } from './repositories/routing-decisions.repository';
import { generateQrToken } from './utils/generate-qr-token.util';
import {
  VISIT_STEP_READY_EVENT,
  VisitStepReadyEvent,
} from '../visits/events/visit-step-ready.event';
import { VISIT_UPDATED_EVENT, VisitUpdatedEvent } from '../visits/events/visit-updated.event';
import { RoutingCandidate, RoutingStrategyName } from './strategies/routing-strategy.interface';
import {
  DEFAULT_ROUTING_STRATEGY_NAME,
  RoutingStrategyRegistry,
} from './strategies/routing-strategy.registry';

/** Ném ra khi 1 tiến trình routing khác đã "claim" step này trước — coi là no-op, không phải lỗi thật */
class AlreadyClaimedError extends Error {}
class VisitAlreadyActiveError extends Error {}

interface VisitRoutingOutcome {
  visitStepId: number;
  selectedRoomId: number;
  simulationRunId: string | null;
  strategyName: RoutingStrategyName;
  reason: string;
  candidates: RoutingCandidate[];
}

@Injectable()
export class RoutingEngineService {
  private readonly logger = new Logger(RoutingEngineService.name);

  constructor(
    private readonly visitStepsRepository: VisitStepsRepository,
    private readonly routingQueueRepository: RoutingQueueRepository,
    private readonly visitsRepository: VisitsRepository,
    private readonly roomsRepository: RoomsRepository,
    private readonly roomTypesRepository: RoomTypesRepository,
    private readonly visitAssignmentsRepository: VisitAssignmentsRepository,
    private readonly visitTokensRepository: VisitTokensRepository,
    private readonly routingDecisionsRepository: RoutingDecisionsRepository,
    private readonly routingStrategyRegistry: RoutingStrategyRegistry,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Trigger tức thời ngay khi VisitsService xác định 1 step vừa READY — không cần chờ cron */
  @OnEvent(VISIT_STEP_READY_EVENT)
  async handleVisitStepReady(event: VisitStepReadyEvent): Promise<void> {
    const step = await this.visitStepsRepository.findById(event.visitStepId);
    if (step) await this.routeNextForVisit(step.visitId);
  }

  /** Lưới an toàn: retry các step PENDING/FAILED (chưa vượt quá số lần thử) mỗi 10 giây */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPendingQueue(): Promise<{ processed: number }> {
    const maxAttempts = this.configService.get<number>(
      'routing.maxRetryAttempts',
    )!;
    const pending = await this.routingQueueRepository.findPending(maxAttempts);

    const visitIds = new Set<string>();
    for (const entry of pending) {
      const step = await this.visitStepsRepository.findById(entry.visitStepId);
      if (step) visitIds.add(step.visitId);
    }
    for (const visitId of visitIds) {
      await this.routeNextForVisit(visitId);
    }

    return { processed: pending.length };
  }

  /**
   * Hiện thực §8 của spec — Routing Engine:
   *  Bước 2 (đã làm ở Phase 5): step này đã ở trạng thái READY
   *  Bước 3: lấy các Room ACTIVE thuộc đúng RoomType
   *  Bước 4: ETA = (đang chờ + đang khám) * avgProcessTime mỗi phòng
   *  Bước 5: chọn phòng theo RoutingStrategy đang cấu hình (mặc định Greedy
   *          ETA nhỏ nhất, tie-break bằng sortOrder — xem
   *          docs/simulator-architecture.md §5.1 "Extract routing strategy
   *          behind an interface")
   *  Bước 6: sinh VisitAssignment + VisitToken (QR)
   *  Bước 7 [MỚI — Phase 3]: ghi lại quyết định vào RoutingDecision (§6 của
   *          spec — "Routing Decision Log"), cho MỌI traffic (thật lẫn mô
   *          phỏng), không chỉ khi chạy simulator.
   */
  async routeNextForVisit(visitId: string): Promise<void> {
    let outcome: VisitRoutingOutcome | null = null;
    const noEligibleStepIds: number[] = [];
    let noEligibleRunId: string | null = null;

    try {
      const transactionResult = await this.prisma.transaction(async (tx) => {
        // Serialize routing decisions for this Visit across application instances.
        await tx.$queryRaw`SELECT id FROM visits WHERE id = ${visitId} FOR UPDATE`;

        const visit = await this.visitsRepository.findById(visitId, tx);
        if (
          !visit ||
          visit.status === VisitStatus.COMPLETED ||
          visit.status === VisitStatus.CANCELLED ||
          (await this.visitAssignmentsRepository.countActiveByVisit(visitId, tx)) > 0
        ) {
          return null;
        }

        const readySteps = (await this.visitStepsRepository.findAllByVisit(visitId, tx)).filter(
          (step) => step.status === VisitStepStatus.READY,
        );
        if (readySteps.length === 0) return null;

        const simulationRunId = visit.simulationRunId ?? null;
        const simulationRoomIds = await this.findSimulationRoomIds(simulationRunId, tx);
        const candidates: RoutingCandidate[] = [];

        for (const step of readySteps) {
          const roomType = await this.roomTypesRepository.findById(step.roomTypeId, tx);
          const eligibleRoomsForType = roomType
            ? await this.roomsRepository.findRoutingEligibleByRoomType(
                step.roomTypeId,
                new Date(),
                tx,
              )
            : [];
          const eligibleRooms = simulationRoomIds
            ? eligibleRoomsForType.filter((room) => simulationRoomIds.has(room.id))
            : eligibleRoomsForType;

          if (!roomType || eligibleRooms.length === 0) {
            noEligibleStepIds.push(step.id);
            noEligibleRunId = simulationRunId;
            continue;
          }

          const roomCandidates = await Promise.all(
            eligibleRooms.map(async (room) => {
              const { inServiceCount, waitingCount } =
                await this.visitAssignmentsRepository.countWorkloadByRoom(
                room.id,
                tx,
              );
              const effectiveAverageProcessTimeSeconds =
                room.avgProcessTime ?? roomType.avgProcessTime;
              return {
                visitStepId: step.id,
                visitStepDisplayOrder: step.displayOrder,
                room: { id: room.id, roomNumber: room.roomNumber, sortOrder: room.sortOrder },
                inServiceCount,
                waitingCount,
                effectiveAverageProcessTimeSeconds,
                estimatedWaitingSeconds:
                  (inServiceCount + waitingCount) * effectiveAverageProcessTimeSeconds,
              };
            }),
          );
          candidates.push(...roomCandidates);
        }

        if (candidates.length === 0) {
          for (const stepId of noEligibleStepIds) {
            await this.routingQueueRepository.markFailed(
              stepId,
              'Không có phòng ACTIVE phù hợp — Admin cần kiểm tra lại',
              tx,
            );
          }
          return null;
        }

        // Production routing has one objective: the global minimum estimated
        // wait. Alternate strategy classes remain available to isolated
        // simulator experiments, but cannot change live routing behaviour.
        const strategyName = DEFAULT_ROUTING_STRATEGY_NAME;
        const decision = this.routingStrategyRegistry.get().select(candidates);
        const selected = candidates.find(
          (candidate) =>
            candidate.visitStepId === decision.selectedVisitStepId &&
            candidate.room.id === decision.selectedRoomId,
        );
        if (!selected) {
          throw new Error(
            `RoutingStrategy '${strategyName}' trả về candidate không tồn tại trong Visit #${visitId}`,
          );
        }

        const claim = await tx.visitStep.updateMany({
          where: { id: selected.visitStepId, visitId, status: VisitStepStatus.READY },
          data: { status: VisitStepStatus.ASSIGNED },
        });
        if (claim.count === 0) throw new AlreadyClaimedError();
        if ((await this.visitAssignmentsRepository.countActiveByVisit(visitId, tx)) > 0) {
          throw new VisitAlreadyActiveError();
        }

        const assignment = await this.visitAssignmentsRepository.create(
          {
            visitStep: { connect: { id: selected.visitStepId } },
            room: { connect: { id: selected.room.id } },
            status: AssignmentStatus.WAITING,
          },
          tx,
        );
        const qrExpiresInSeconds = this.configService.get<number>('routing.qrExpiresInSeconds')!;
        await this.visitTokensRepository.create(
          {
            visitAssignment: { connect: { id: assignment.id } },
            token: generateQrToken(),
            expiresAt: new Date(Date.now() + qrExpiresInSeconds * 1000),
          },
          tx,
        );
        await this.routingQueueRepository.delete(selected.visitStepId, tx);

        return {
          visitStepId: selected.visitStepId,
          selectedRoomId: selected.room.id,
          simulationRunId,
          strategyName,
          reason: decision.reason,
          candidates,
        };
      });
      outcome = transactionResult;
    } catch (err) {
      if (err instanceof AlreadyClaimedError || err instanceof VisitAlreadyActiveError) return;
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Routing thất bại cho Visit #${visitId}: ${message}`);
      return;
    }

    for (const visitStepId of noEligibleStepIds) {
      await this.recordDecision({
        visitStepId,
        simulationRunId: noEligibleRunId,
        strategyName: DEFAULT_ROUTING_STRATEGY_NAME,
        selectedRoomId: null,
        reason: 'NO_ELIGIBLE_ROOM',
        candidates: [],
      });
    }
    if (!outcome) return;

    this.logger.log(
      `Visit #${visitId}, VisitStep #${outcome.visitStepId} -> Room #${outcome.selectedRoomId}, strategy=${outcome.strategyName}, reason=${outcome.reason}`,
    );
    await this.recordDecision(outcome);
    this.eventEmitter.emit(VISIT_UPDATED_EVENT, new VisitUpdatedEvent(visitId));
  }

  private async findSimulationRoomIds(
    simulationRunId: string | null,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<Set<number> | null> {
    if (!simulationRunId) return null;

    const run = await db.simulationRun.findUnique({
      where: { id: simulationRunId },
      select: { config: true },
    });
    if (!run || !run.config || typeof run.config !== 'object' || Array.isArray(run.config)) {
      return new Set();
    }

    const rooms = (run.config as { rooms?: unknown }).rooms;
    if (!Array.isArray(rooms)) return new Set();

    return new Set(
      rooms.flatMap((room) => {
        if (!room || typeof room !== 'object' || Array.isArray(room)) return [];
        const roomId = (room as { roomId?: unknown }).roomId;
        return typeof roomId === 'number' ? [roomId] : [];
      }),
    );
  }

  private async recordDecision(input: {
    visitStepId: number;
    simulationRunId: string | null;
    strategyName: RoutingStrategyName;
    selectedRoomId: number | null;
    reason: string;
    candidates: RoutingCandidate[];
  }): Promise<void> {
    try {
      await this.routingDecisionsRepository.create({
        visitStepId: input.visitStepId,
        run: input.simulationRunId ? { connect: { id: input.simulationRunId } } : undefined,
        strategy: input.strategyName,
        selectedRoomId: input.selectedRoomId,
        reason: input.reason,
        candidates: input.candidates.map((c) => ({
          visitStepId: c.visitStepId,
          roomId: c.room.id,
          roomNumber: c.room.roomNumber,
          sortOrder: c.room.sortOrder,
          inServiceCount: c.inServiceCount,
          waitingCount: c.waitingCount,
          effectiveAverageProcessTimeSeconds: c.effectiveAverageProcessTimeSeconds,
          estimatedWaitingSeconds: c.estimatedWaitingSeconds,
        })),
      });
    } catch (err) {
      // Ghi log KHÔNG BAO GIỜ được làm hỏng luồng routing thật — 1 lỗi ghi
      // RoutingDecision (vd bảng bị khoá tạm thời) không được phép khiến
      // bệnh nhân không được xếp phòng. Log lỗi rồi bỏ qua.
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `Không ghi được RoutingDecision cho VisitStep #${input.visitStepId}: ${message}`,
      );
    }
  }
}
