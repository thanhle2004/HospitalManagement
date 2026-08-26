import { Injectable } from '@nestjs/common';
import { Flow, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;
export type FlowWithStepCount = Flow & { _count: { steps: number } };

@Injectable()
export class FlowsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCode(code: string, db: Db = this.prisma): Promise<Flow | null> {
    return db.flow.findUnique({ where: { code } });
  }

  create(data: Prisma.FlowCreateInput, db: Db = this.prisma): Promise<Flow> {
    return db.flow.create({ data });
  }

  findAll(db: Db = this.prisma): Promise<FlowWithStepCount[]> {
    return db.flow.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { steps: true } } },
      orderBy: { name: 'asc' },
    });
  }

  findByIdWithCount(
    id: number,
    db: Db = this.prisma,
  ): Promise<FlowWithStepCount | null> {
    return db.flow.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { steps: true } } },
    });
  }

  findById(id: number, db: Db = this.prisma): Promise<Flow | null> {
    return db.flow.findFirst({ where: { id, deletedAt: null } });
  }

  /** Toàn bộ graph (steps + dependency của từng step) — dùng cho GET /flows/:id và Phase 5 copy sang VisitStep */
  findByIdWithGraph(id: number, db: Db = this.prisma) {
    return db.flow.findFirst({
      where: { id, deletedAt: null },
      include: {
        steps: {
          include: {
            roomType: true,
            dependencies: true, // FlowDependency[] mà step này là "stepId" -> chính là cạnh (requiredStepId) của nó
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  update(
    id: number,
    data: Prisma.FlowUpdateInput,
    db: Db = this.prisma,
  ): Promise<Flow> {
    return db.flow.update({ where: { id }, data });
  }

  softDelete(id: number, db: Db = this.prisma): Promise<Flow> {
    return db.flow.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
