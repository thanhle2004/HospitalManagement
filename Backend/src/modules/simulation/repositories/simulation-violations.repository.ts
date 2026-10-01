import { Injectable } from '@nestjs/common';
import { Prisma, SimulationViolation } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SimulationViolationInput } from '../metrics/simulation-sweep.types';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class SimulationViolationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createMany(
    runId: string,
    simTimeMs: number,
    violations: readonly SimulationViolationInput[],
    db: Db = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    if (violations.length === 0) return Promise.resolve({ count: 0 });
    return db.simulationViolation.createMany({
      data: violations.map((v) => ({
        runId,
        simTimeMs,
        rule: v.rule,
        severity: v.severity,
        visitId: v.visitId,
        visitStepId: v.visitStepId,
        roomId: v.roomId,
        stateSnapshot: v.stateSnapshot as Prisma.InputJsonValue,
      })),
    });
  }

  findAllByRun(runId: string, db: Db = this.prisma): Promise<SimulationViolation[]> {
    return db.simulationViolation.findMany({
      where: { runId },
      orderBy: { simTimeMs: 'asc' },
    });
  }
}