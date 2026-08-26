import { Injectable } from '@nestjs/common';
import { Flow, Prisma, Visit, VisitStatus, AssignmentStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;
export type VisitWithFlow = Visit & { flow: Flow };

@Injectable()
export class VisitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.VisitCreateInput, db: Db = this.prisma): Promise<Visit> {
    return db.visit.create({ data });
  }

  findAllByPatient(
    patientId: string,
    db: Db = this.prisma,
  ): Promise<VisitWithFlow[]> {
    return db.visit.findMany({
      where: { patientId },
      include: { flow: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAll(db: Db = this.prisma): Promise<VisitWithFlow[]> {
    return db.visit.findMany({
      include: { flow: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string, db: Db = this.prisma): Promise<VisitWithFlow | null> {
    return db.visit.findUnique({ where: { id }, include: { flow: true } });
  }

  /** Toàn bộ graph VisitStep runtime — dùng cho GET chi tiết + Phase 6/8 đọc lại */
  findByIdWithGraph(id: string, db: Db = this.prisma) {
    return db.visit.findUnique({
      where: { id },
      include: {
        flow: true,
        steps: {
          include: {
            roomType: true,
            flowStep: true,
            dependencies: true, // VisitStepDependency[] mà step này là "stepId"
            // Assignment còn hiệu lực gần nhất (bỏ qua các lần đã bị reroute/huỷ)
            assignments: {
              where: { status: { not: AssignmentStatus.CANCELLED } },
              orderBy: { assignedAt: 'desc' },
              take: 1,
              include: { room: true, qrToken: true },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  updateStatus(
    id: string,
    status: VisitStatus,
    extra: Partial<
      Pick<Visit, 'startedAt' | 'completedAt' | 'cancelledAt'>
    > = {},
    db: Db = this.prisma,
  ): Promise<Visit> {
    return db.visit.update({ where: { id }, data: { status, ...extra } });
  }
}
