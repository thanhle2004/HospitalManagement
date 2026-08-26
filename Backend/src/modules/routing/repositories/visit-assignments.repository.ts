import { Injectable } from '@nestjs/common';
import { AssignmentStatus, Prisma, VisitAssignment, VisitStep } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;
export type VisitAssignmentWithStep = VisitAssignment & { visitStep: VisitStep };

@Injectable()
export class VisitAssignmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.VisitAssignmentCreateInput,
    db: Db = this.prisma,
  ): Promise<VisitAssignment> {
    return db.visitAssignment.create({ data });
  }

  findById(id: number, db: Db = this.prisma): Promise<VisitAssignment | null> {
    return db.visitAssignment.findUnique({ where: { id } });
  }

  /** Dùng ở Phase 8 (start/complete exam) — cần visitId từ visitStep để chạy resolveDependencies */
  findByIdWithStep(
    id: number,
    db: Db = this.prisma,
  ): Promise<VisitAssignmentWithStep | null> {
    return db.visitAssignment.findUnique({
      where: { id },
      include: { visitStep: true },
    });
  }

  updateStatus(
    id: number,
    status: AssignmentStatus,
    extra: Partial<
      Pick<
        VisitAssignment,
        'checkedInAt' | 'startedAt' | 'completedAt' | 'cancelledAt' | 'doctorId'
      >
    > = {},
    db: Db = this.prisma,
  ): Promise<VisitAssignment> {
    return db.visitAssignment.update({ where: { id }, data: { status, ...extra } });
  }

  /**
   * Đếm số VisitAssignment đang "chiếm dụng" 1 phòng — dùng cho công thức
   * ETA (§8 bước 4: "Số lượng bệnh nhân đang chờ" + "Bệnh nhân đang được
   * khám" = mọi assignment CHƯA hoàn thành/huỷ tại phòng đó).
   */
  countActiveByRoom(roomId: number, db: Db = this.prisma): Promise<number> {
    return db.visitAssignment.count({
      where: {
        roomId,
        status: {
          in: [
            AssignmentStatus.WAITING,
            AssignmentStatus.CHECKED_IN,
            AssignmentStatus.IN_PROGRESS,
          ],
        },
      },
    });
  }
}
