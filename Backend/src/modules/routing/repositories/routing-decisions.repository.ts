import { Injectable } from '@nestjs/common';
import { Prisma, RoutingDecision } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class RoutingDecisionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.RoutingDecisionCreateInput, db: Db = this.prisma): Promise<RoutingDecision> {
    return db.routingDecision.create({ data });
  }

  findAllByVisitStep(visitStepId: number, db: Db = this.prisma): Promise<RoutingDecision[]> {
    return db.routingDecision.findMany({
      where: { visitStepId },
      orderBy: { decidedAt: 'asc' },
    });
  }

  /** [Phase 8] Dùng bởi SimulationAssertionsRunner để lấy quyết định routing
   * chỉ trong phạm vi các step đang được sweep. */
  findAllByVisitStepIds(
    visitStepIds: number[],
    db: Db = this.prisma,
  ): Promise<RoutingDecision[]> {
    if (visitStepIds.length === 0) return Promise.resolve([]);
    return db.routingDecision.findMany({
      where: { visitStepId: { in: visitStepIds } },
      orderBy: { decidedAt: 'asc' },
    });
  }

  /** Dùng cho Room Inspector (§9) và các chart phân bố sai số ETA (§10) — lọc
   * theo phòng ĐƯỢC CHỌN. `runId: null` lấy đúng traffic sản xuất thật, bỏ
   * qua mọi quyết định của simulator. */
  findAllBySelectedRoom(
    selectedRoomId: number,
    runId: string | null,
    db: Db = this.prisma,
  ): Promise<RoutingDecision[]> {
    return db.routingDecision.findMany({
      where: { selectedRoomId, runId },
      orderBy: { decidedAt: 'desc' },
    });
  }
}