import { Injectable } from '@nestjs/common';
import { AssignmentStatus, Prisma, VisitAssignment, VisitStep } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;
export type VisitAssignmentWithStep = VisitAssignment & { visitStep: VisitStep };

export interface RoomAssignmentWorkload {
  /** A room can serve at most one assignment at a time. */
  inServiceCount: number;
  /** Patients assigned to the room but not yet in service. */
  waitingCount: number;
}

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
   * Return the two explicit terms used by the routing ETA formula. Keeping
   * them separate prevents an aggregate "active" count from accidentally
   * including COMPLETED/CANCELLED assignments or obscuring queue semantics.
   */
  async countWorkloadByRoom(
    roomId: number,
    db: Db = this.prisma,
  ): Promise<RoomAssignmentWorkload> {
    const [inServiceCount, waitingCount] = await Promise.all([
      db.visitAssignment.count({
        where: { roomId, status: AssignmentStatus.IN_PROGRESS },
      }),
      db.visitAssignment.count({
        where: {
          roomId,
          status: {
            in: [AssignmentStatus.WAITING, AssignmentStatus.CHECKED_IN],
          },
        },
      }),
    ]);

    return { inServiceCount, waitingCount };
  }

  countActiveByVisit(visitId: string, db: Db = this.prisma): Promise<number> {
    return db.visitAssignment.count({
      where: {
        visitStep: { visitId },
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
