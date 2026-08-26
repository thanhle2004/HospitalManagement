import { Injectable } from '@nestjs/common';
import { FlowStep, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class FlowStepsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.FlowStepCreateInput,
    db: Db = this.prisma,
  ): Promise<FlowStep> {
    return db.flowStep.create({ data });
  }

  findByFlowAndCode(
    flowId: number,
    code: string,
    db: Db = this.prisma,
  ): Promise<FlowStep | null> {
    return db.flowStep.findUnique({
      where: { flowId_code: { flowId, code } },
    });
  }

  findAllByFlow(flowId: number, db: Db = this.prisma): Promise<FlowStep[]> {
    return db.flowStep.findMany({
      where: { flowId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  findById(id: number, db: Db = this.prisma): Promise<FlowStep | null> {
    return db.flowStep.findUnique({ where: { id } });
  }

  update(
    id: number,
    data: Prisma.FlowStepUpdateInput,
    db: Db = this.prisma,
  ): Promise<FlowStep> {
    return db.flowStep.update({ where: { id }, data });
  }

  /** onDelete: Cascade ở schema tự xoá luôn FlowDependency liên quan tới step này */
  delete(id: number, db: Db = this.prisma): Promise<FlowStep> {
    return db.flowStep.delete({ where: { id } });
  }
}
