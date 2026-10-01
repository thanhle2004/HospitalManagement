import { Injectable } from '@nestjs/common';
import {
  DeviceStatus,
  DeviceType,
  Prisma,
  Room,
  RoomStatus,
  RoomType,
  UserRole,
  UserStatus,
} from '@prisma/client';
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
  ): Promise<RoomWithType[]> {
    return db.room.findMany({
      where: { roomTypeId, status: RoomStatus.ACTIVE },
      include: { roomType: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * Physical rooms that can actually accept a routed patient right now.
   * The current patient flow always issues a room QR token, therefore a
   * live QR scanner is mandatory in addition to an ACTIVE room and a
   * confirmed doctor whose shift covers `at`.
   */
  findRoutingEligibleByRoomType(
    roomTypeId: number,
    at: Date,
    db: Db = this.prisma,
  ): Promise<RoomWithType[]> {
    return db.room.findMany({
      where: {
        roomTypeId,
        status: RoomStatus.ACTIVE,
        doctorAssignments: {
          some: {
            startTime: { lte: at },
            roomConfirmedAt: { not: null },
            OR: [{ endTime: null }, { endTime: { gt: at } }],
            doctor: {
              role: UserRole.DOCTOR,
              status: UserStatus.ACTIVE,
            },
          },
        },
        devices: {
          some: {
            type: DeviceType.QR_SCANNER,
            status: DeviceStatus.ACTIVE,
          },
        },
      },
      include: { roomType: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
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
