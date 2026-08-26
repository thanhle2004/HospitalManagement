import { Injectable } from '@nestjs/common';
import { Prisma, VisitStepDependency } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class VisitStepDependenciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  createMany(
    data: Prisma.VisitStepDependencyCreateManyInput[],
    db: Db = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    if (data.length === 0) return Promise.resolve({ count: 0 });
    return db.visitStepDependency.createMany({ data });
  }

  /** VisitStepDependency không có cột visitId trực tiếp — lọc qua relation step.visitId */
  findAllByVisit(
    visitId: string,
    db: Db = this.prisma,
  ): Promise<VisitStepDependency[]> {
    return db.visitStepDependency.findMany({ where: { step: { visitId } } });
  }
}
