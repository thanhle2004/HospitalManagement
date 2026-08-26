import { Injectable } from '@nestjs/common';
import { Prisma, RoomRuntime } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class RoomRuntimeRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tự tạo RoomRuntime nếu chưa có (self-healing cho các Room được tạo
   * TRƯỚC khi RoomsService.create() được sửa để luôn tạo kèm RoomRuntime).
   * Không dùng update nếu đã tồn tại — giữ nguyên version hiện tại.
   */
  ensureExists(roomId: number, db: Db = this.prisma): Promise<RoomRuntime> {
    return db.roomRuntime.upsert({
      where: { roomId },
      update: {},
      create: { roomId },
    });
  }

  findByRoomId(roomId: number, db: Db = this.prisma): Promise<RoomRuntime | null> {
    return db.roomRuntime.findUnique({ where: { roomId } });
  }

  /**
   * Optimistic locking: chỉ ghi nếu version vẫn khớp — nếu 2 tiến trình
   * "start exam" cùng lúc claim 1 phòng, chỉ 1 trong 2 thành công
   * (count = 0 ở tiến trình thua cuộc, tự retry hoặc báo lỗi rõ ràng).
   */
  async trySetCurrentAssignment(
    roomId: number,
    visitAssignmentId: number | null,
    expectedVersion: number,
    db: Db = this.prisma,
  ): Promise<boolean> {
    const result = await db.roomRuntime.updateMany({
      where: { roomId, version: expectedVersion },
      data: { currentVisitAssignmentId: visitAssignmentId, version: { increment: 1 } },
    });
    return result.count > 0;
  }
}
