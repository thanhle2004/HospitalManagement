import { Injectable } from '@nestjs/common';
import { Prisma, RoutingQueue, RoutingStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class RoutingQueueRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Đẩy các VisitStep vừa chuyển sang READY vào hàng đợi routing (status mặc định PENDING) */
  enqueueMany(
    visitStepIds: number[],
    db: Db = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    if (visitStepIds.length === 0) return Promise.resolve({ count: 0 });
    return db.routingQueue.createMany({
      data: visitStepIds.map((visitStepId) => ({ visitStepId })),
    });
  }

  /** retryCount < maxAttempts — bỏ qua các entry đã FAILED vĩnh viễn (vượt quá số lần thử) */
  findPending(
    maxAttempts: number,
    db: Db = this.prisma,
  ): Promise<RoutingQueue[]> {
    return db.routingQueue.findMany({
      where: {
        status: { in: [RoutingStatus.PENDING, RoutingStatus.FAILED] },
        retryCount: { lt: maxAttempts },
      },
      orderBy: { enqueueAt: 'asc' },
    });
  }

  markProcessing(
    visitStepId: number,
    db: Db = this.prisma,
  ): Promise<RoutingQueue> {
    return db.routingQueue.update({
      where: { visitStepId },
      data: { status: RoutingStatus.PROCESSING, processingAt: new Date() },
    });
  }

  markFailed(
    visitStepId: number,
    error: string,
    db: Db = this.prisma,
  ): Promise<RoutingQueue> {
    return db.routingQueue.update({
      where: { visitStepId },
      data: {
        status: RoutingStatus.FAILED,
        lastError: error,
        retryCount: { increment: 1 },
      },
    });
  }

  /** Routing thành công — xoá khỏi queue, VisitAssignment vừa tạo là bằng chứng vĩnh viễn, không cần giữ lại hàng đợi */
  delete(visitStepId: number, db: Db = this.prisma): Promise<RoutingQueue> {
    return db.routingQueue.delete({ where: { visitStepId } });
  }

  /** Giống delete() nhưng không throw nếu entry không tồn tại (dùng khi skip step mà không chắc đã enqueue hay chưa) */
  async deleteIfExists(visitStepId: number, db: Db = this.prisma): Promise<void> {
    await db.routingQueue.deleteMany({ where: { visitStepId } });
  }
}
