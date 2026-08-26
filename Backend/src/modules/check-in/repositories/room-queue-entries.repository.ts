import { Injectable } from '@nestjs/common';
import { Prisma, QueueEntrySource, RoomQueueEntry } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class RoomQueueEntriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.RoomQueueEntryCreateInput,
    db: Db = this.prisma,
  ): Promise<RoomQueueEntry> {
    return db.roomQueueEntry.create({ data });
  }

  findById(id: number, db: Db = this.prisma): Promise<RoomQueueEntry | null> {
    return db.roomQueueEntry.findUnique({ where: { id } });
  }

  /**
   * position dùng fractional ordering (xem ghi chú trong schema.prisma) —
   * Phase 7 luôn APPEND vào cuối hàng đợi nên chỉ cần lấy max hiện tại + 1.
   * Việc chèn giữa hàng đợi (fractional thực sự) dùng ở Phase 10 — xem
   * getMinPosition()/findNextAfter() bên dưới.
   */
  async getNextPosition(roomId: number, db: Db = this.prisma): Promise<number> {
    const last = await db.roomQueueEntry.findFirst({
      where: { roomId },
      orderBy: { position: 'desc' },
    });
    return (last?.position ?? 0) + 1;
  }

  /** [Phase 10] Vị trí nhỏ nhất hiện có trong phòng — dùng để tính "đưa lên đầu hàng đợi" */
  async getMinPosition(roomId: number, db: Db = this.prisma): Promise<number | null> {
    const first = await db.roomQueueEntry.findFirst({
      where: { roomId },
      orderBy: { position: 'asc' },
    });
    return first?.position ?? null;
  }

  /** [Phase 10] Entry đứng NGAY SAU 1 vị trí cho trước — dùng để tính midpoint khi chèn giữa hàng đợi */
  findNextAfter(
    roomId: number,
    position: number,
    db: Db = this.prisma,
  ): Promise<RoomQueueEntry | null> {
    return db.roomQueueEntry.findFirst({
      where: { roomId, position: { gt: position } },
      orderBy: { position: 'asc' },
    });
  }

  /** [Phase 10] Admin đổi vị trí thủ công — luôn kèm đổi source thành MANUAL_ADMIN để phân biệt với check-in tự động */
  updatePosition(
    id: number,
    position: number,
    db: Db = this.prisma,
  ): Promise<RoomQueueEntry> {
    return db.roomQueueEntry.update({
      where: { id },
      data: { position, source: QueueEntrySource.MANUAL_ADMIN },
    });
  }

  findAllByRoom(roomId: number, db: Db = this.prisma): Promise<RoomQueueEntry[]> {
    return db.roomQueueEntry.findMany({
      where: { roomId },
      orderBy: { position: 'asc' },
    });
  }

  /** [Phase 8] Hàng đợi đầy đủ thông tin (bệnh nhân, bước khám) cho các phòng Doctor đang trực */
  findAllByRoomsWithDetails(roomIds: number[], db: Db = this.prisma) {
    if (roomIds.length === 0) return Promise.resolve([]);
    return db.roomQueueEntry.findMany({
      where: { roomId: { in: roomIds } },
      include: {
        room: true,
        visitAssignment: {
          include: {
            visitStep: {
              include: {
                roomType: true,
                visit: { include: { patient: true } },
              },
            },
          },
        },
      },
      orderBy: [{ roomId: 'asc' }, { position: 'asc' }],
    });
  }

  /** [Phase 10] Giống trên nhưng KHÔNG lọc theo phòng — Admin xem toàn viện */
  findAllWithDetails(db: Db = this.prisma) {
    return db.roomQueueEntry.findMany({
      include: {
        room: true,
        visitAssignment: {
          include: {
            visitStep: {
              include: {
                roomType: true,
                visit: { include: { patient: true } },
              },
            },
          },
        },
      },
      orderBy: [{ roomId: 'asc' }, { position: 'asc' }],
    });
  }

  /** Dequeue khi khám xong — bệnh nhân rời khỏi hàng đợi vật lý của phòng */
  deleteByVisitAssignment(
    visitAssignmentId: number,
    db: Db = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    return db.roomQueueEntry.deleteMany({ where: { visitAssignmentId } });
  }
}
