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

  /** [Phase 8] Tải toàn bộ graph của các Visit thuộc 1 SimulationRun để
   * SimulationAssertionsRunner lấy state theo run và kiểm tra A1-A12. */
  findAllBySimulationRunWithGraph(
    simulationRunId: string,
    db: Db = this.prisma,
  ): Promise<any[]> {
    return db.visit.findMany({
      where: { simulationRunId },
      include: {
        flow: true,
        patient: true,
        steps: {
          include: {
            roomType: true,
            flowStep: true,
            dependencies: true,
            assignments: {
              where: { status: { not: AssignmentStatus.CANCELLED } },
              orderBy: { assignedAt: 'desc' },
              take: 1,
              include: {
                room: true,
                qrToken: true,
                queueEntry: true,
                roomRuntime: true,
              },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
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

  /** [Simulator Phase 0] Xoá toàn bộ Visit tổng hợp của 1 run — cascades qua
   * VisitStep -> VisitAssignment -> VisitToken/CheckInLog/RoomQueueEntry và
   * VisitStep -> RoutingQueue/VisitStepDependency (xem schema.prisma). PHẢI
   * gọi TRƯỚC PatientsRepository.deleteManyBySimulationRun trong cùng 1
   * transaction — Visit.patientId là quan hệ bắt buộc không khai báo
   * onDelete nên mặc định là RESTRICT, xoá Patient trước sẽ lỗi FK. */
  deleteManyBySimulationRun(
    simulationRunId: string,
    db: Db = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    return db.visit.deleteMany({ where: { simulationRunId } });
  }
}