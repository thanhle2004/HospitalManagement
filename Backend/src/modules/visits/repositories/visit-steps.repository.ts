import { Injectable } from '@nestjs/common';
import { Prisma, VisitStep, VisitStepStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class VisitStepsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.VisitStepCreateInput,
    db: Db = this.prisma,
  ): Promise<VisitStep> {
    return db.visitStep.create({ data });
  }

  findAllByVisit(visitId: string, db: Db = this.prisma): Promise<VisitStep[]> {
    return db.visitStep.findMany({ where: { visitId } });
  }

  findById(id: number, db: Db = this.prisma): Promise<VisitStep | null> {
    return db.visitStep.findUnique({ where: { id } });
  }

  updateStatus(
    id: number,
    status: VisitStepStatus,
    extra: Partial<Pick<VisitStep, 'completedAt'>> = {},
    db: Db = this.prisma,
  ): Promise<VisitStep> {
    return db.visitStep.update({ where: { id }, data: { status, ...extra } });
  }

  /** Đặt trạng thái cho nhiều VisitStep cùng lúc (vd: LOCKED -> READY sau khi tính findReadyNodes) */
  updateManyStatus(
    ids: number[],
    status: VisitStepStatus,
    db: Db = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    if (ids.length === 0) return Promise.resolve({ count: 0 });
    return db.visitStep.updateMany({ where: { id: { in: ids } }, data: { status } });
  }
}
