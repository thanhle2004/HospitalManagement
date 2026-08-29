import { Injectable } from '@nestjs/common';
import {
  DoctorAssignment,
  Prisma,
  Room,
  User,
  UserProfile,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;
export type DoctorAssignmentWithRelations = DoctorAssignment & {
  doctor: User & { profile: UserProfile | null };
  room: Room;
};

@Injectable()
export class DoctorAssignmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.DoctorAssignmentCreateInput,
    db: Db = this.prisma,
  ): Promise<DoctorAssignment> {
    return db.doctorAssignment.create({ data });
  }

  findById(
    id: number,
    db: Db = this.prisma,
  ): Promise<DoctorAssignmentWithRelations | null> {
    return db.doctorAssignment.findUnique({
      where: { id },
      include: { doctor: { include: { profile: true } }, room: true },
    });
  }

  findAll(
    filter: { doctorId?: string; roomId?: number; activeOnly?: boolean },
    db: Db = this.prisma,
  ): Promise<DoctorAssignmentWithRelations[]> {
    return db.doctorAssignment.findMany({
      where: {
        doctorId: filter.doctorId,
        roomId: filter.roomId,
        ...(filter.activeOnly
          ? { OR: [{ endTime: null }, { endTime: { gt: new Date() } }] }
          : {}),
      },
      include: { doctor: { include: { profile: true } }, room: true },
      orderBy: { startTime: 'desc' },
    });
  }

  /** Ca đang diễn ra hoặc sắp tới của riêng bác sĩ, dùng cho màn hình Doctor. */
  findCurrentAndUpcomingForDoctor(
    doctorId: string,
    db: Db = this.prisma,
  ): Promise<DoctorAssignmentWithRelations[]> {
    const now = new Date();
    return db.doctorAssignment.findMany({
      where: {
        doctorId,
        OR: [{ endTime: null }, { endTime: { gt: now } }],
      },
      include: { doctor: { include: { profile: true } }, room: true },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Tìm các ca trực HIỆN CÓ của 1 doctor giao nhau với khoảng [startTime, endTime).
   * endTime = null nghĩa là ca trực mở (tới vô hạn). Công thức giao nhau chuẩn:
   * existing.startTime < newEnd  AND  newStart < existing.endTime
   * (coi endTime = null là +vô cực ở cả 2 vế).
   */
  findOverlapping(
    doctorId: string,
    startTime: Date,
    endTime: Date | null,
    excludeId?: number,
    db: Db = this.prisma,
  ): Promise<DoctorAssignment[]> {
    return db.doctorAssignment.findMany({
      where: {
        doctorId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        ...(endTime ? { startTime: { lt: endTime } } : {}),
        OR: [{ endTime: null }, { endTime: { gt: startTime } }],
      },
    });
  }

  findRoomOverlapping(
    roomId: number,
    startTime: Date,
    endTime: Date | null,
    excludeId?: number,
    db: Db = this.prisma,
  ): Promise<DoctorAssignment[]> {
    return db.doctorAssignment.findMany({
      where: {
        roomId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        ...(endTime ? { startTime: { lt: endTime } } : {}),
        OR: [{ endTime: null }, { endTime: { gt: startTime } }],
      },
    });
  }

  endShift(
    id: number,
    endTime: Date,
    db: Db = this.prisma,
  ): Promise<DoctorAssignment> {
    return db.doctorAssignment.update({ where: { id }, data: { endTime } });
  }

  confirmRoom(
    id: number,
    roomConfirmedAt: Date,
    db: Db = this.prisma,
  ): Promise<DoctorAssignment> {
    return db.doctorAssignment.update({
      where: { id },
      data: { roomConfirmedAt },
    });
  }

  delete(id: number, db: Db = this.prisma): Promise<DoctorAssignment> {
    return db.doctorAssignment.delete({ where: { id } });
  }

  /**
   * Danh sách phòng bác sĩ đang trực VÀ đã xác nhận có mặt. Đây là nguồn
   * quyền duy nhất để mở hàng đợi và thực hiện khám.
   */
  async findActiveRoomIdsForDoctor(
    doctorId: string,
    db: Db = this.prisma,
  ): Promise<number[]> {
    const now = new Date();
    const rows = await db.doctorAssignment.findMany({
      where: {
        doctorId,
        startTime: { lte: now },
        roomConfirmedAt: { not: null },
        OR: [{ endTime: null }, { endTime: { gt: now } }],
      },
      select: { roomId: true },
    });
    return rows.map((r) => r.roomId);
  }
}
