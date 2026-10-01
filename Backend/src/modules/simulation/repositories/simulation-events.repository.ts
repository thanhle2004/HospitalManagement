import { Injectable } from '@nestjs/common';
import { Prisma, SimulationEvent } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

export interface SimulationEventInput {
  simTimeMs: number;
  seq: number;
  type: string;
  visitId?: string;
  visitStepId?: number;
  roomId?: number;
  payload?: unknown;
}

@Injectable()
export class SimulationEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** [Phase 4] Ghi theo batch — KHÔNG BAO GIỜ gọi 1-event-1-insert trong lúc
   * run đang chạy (xem cảnh báo write-volume ở
   * docs/simulator-architecture.md §5.3). Caller (SimulationOrchestrator)
   * chịu trách nhiệm gom event vào SimulationEventBuffer rồi flush theo lô. */
  createMany(
    runId: string,
    events: readonly SimulationEventInput[],
    db: Db = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    if (events.length === 0) return Promise.resolve({ count: 0 });
    return db.simulationEvent.createMany({
      data: events.map((e) => ({
        runId,
        simTimeMs: e.simTimeMs,
        seq: e.seq,
        type: e.type,
        visitId: e.visitId,
        visitStepId: e.visitStepId,
        roomId: e.roomId,
        payload: e.payload === undefined ? undefined : (e.payload as Prisma.InputJsonValue),
      })),
    });
  }

  findAllByRun(runId: string, db: Db = this.prisma): Promise<SimulationEvent[]> {
    return db.simulationEvent.findMany({
      where: { runId },
      orderBy: [{ simTimeMs: 'asc' }, { seq: 'asc' }],
    });
  }
}