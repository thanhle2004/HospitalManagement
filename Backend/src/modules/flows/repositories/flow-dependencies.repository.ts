import { Injectable } from '@nestjs/common';
import { FlowDependency, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class FlowDependenciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.FlowDependencyCreateInput,
    db: Db = this.prisma,
  ): Promise<FlowDependency> {
    return db.flowDependency.create({ data });
  }

  /** FlowDependency không có cột flowId trực tiếp — lọc qua relation step.flowId */
  findAllByFlow(
    flowId: number,
    db: Db = this.prisma,
  ): Promise<FlowDependency[]> {
    return db.flowDependency.findMany({ where: { step: { flowId } } });
  }

  delete(
    stepId: number,
    requiredStepId: number,
    db: Db = this.prisma,
  ): Promise<FlowDependency> {
    return db.flowDependency.delete({
      where: { stepId_requiredStepId: { stepId, requiredStepId } },
    });
  }

  findOne(
    stepId: number,
    requiredStepId: number,
    db: Db = this.prisma,
  ): Promise<FlowDependency | null> {
    return db.flowDependency.findUnique({
      where: { stepId_requiredStepId: { stepId, requiredStepId } },
    });
  }
}
