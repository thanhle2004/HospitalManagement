import { Injectable } from '@nestjs/common';
import { Prisma, Room, RoomStatus, RoomType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;
export type RoomWithType = Room & { roomType: RoomType };

@Injectable()
export class RoomsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.RoomCreateInput, db: Db = this.prisma): Promise<Room> {
    return db.room.create({ data });
  }

  findByRoomNumber(
    roomNumber: string,
    db: Db = this.prisma,
  ): Promise<Room | null> {
    return db.room.findUnique({ where: { roomNumber } });
  }

  findAll(
    filter: { roomTypeId?: number; status?: RoomStatus },
    db: Db = this.prisma,
  ): Promise<RoomWithType[]> {
    return db.room.findMany({
      where: {
        roomTypeId: filter.roomTypeId,
        status: filter.status,
      },
      include: { roomType: true },
      orderBy: [{ roomTypeId: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  findById(id: number, db: Db = this.prisma): Promise<RoomWithType | null> {
    return db.room.findUnique({
      where: { id },
      include: { roomType: true },
    });
  }

  /** Danh sách phòng ACTIVE thuộc 1 RoomType — Routing Engine (Phase 6) sẽ dùng lại hàm này */
  findActiveByRoomType(
    roomTypeId: number,
    db: Db = this.prisma,
  ): Promise<Room[]> {
    return db.room.findMany({
      where: { roomTypeId, status: RoomStatus.ACTIVE },
    });
  }

  update(
    id: number,
    data: Prisma.RoomUpdateInput,
    db: Db = this.prisma,
  ): Promise<Room> {
    return db.room.update({ where: { id }, data });
  }

  updateStatus(
    id: number,
    status: RoomStatus,
    db: Db = this.prisma,
  ): Promise<Room> {
    return db.room.update({ where: { id }, data: { status } });
  }
}
