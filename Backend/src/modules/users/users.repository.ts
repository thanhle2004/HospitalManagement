import { Injectable } from '@nestjs/common';
import { Prisma, User, UserProfile, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;
export type UserWithProfile = User & { profile: UserProfile | null };

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string, db: Db = this.prisma): Promise<User | null> {
    return db.user.findUnique({ where: { email } });
  }

  findById(id: string, db: Db = this.prisma): Promise<UserWithProfile | null> {
    return db.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

  findAllByRole(role: UserRole, db: Db = this.prisma): Promise<UserWithProfile[]> {
    return db.user.findMany({
      where: { role, deletedAt: null },
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  createStaff(data: Prisma.UserCreateInput, db: Db = this.prisma): Promise<User> {
    return db.user.create({ data });
  }

  createProfile(
    data: Prisma.UserProfileCreateInput,
    db: Db = this.prisma,
  ): Promise<UserProfile> {
    return db.userProfile.create({ data });
  }

  updateStatus(id: string, status: UserStatus, db: Db = this.prisma): Promise<User> {
    return db.user.update({
      where: { id },
      data: { status, tokenVersion: { increment: 1 } },
    });
  }

  updatePassword(id: string, passwordHash: string, db: Db = this.prisma): Promise<User> {
    return db.user.update({
      where: { id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
  }

  incrementTokenVersion(id: string, db: Db = this.prisma): Promise<User> {
    return db.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  updateLastLogin(id: string, db: Db = this.prisma): Promise<User> {
    return db.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  updateProfile(
    userId: string,
    data: Prisma.UserProfileUpdateInput,
    db: Db = this.prisma,
  ): Promise<UserProfile> {
    return db.userProfile.update({ where: { userId }, data });
  }

  /** [Simulator Phase 0] Xoá cứng (không phải soft-delete) — CHỈ dùng cho
   * User bác sĩ tổng hợp do fixtures service tạo ra. DoctorAssignment.doctor
   * có onDelete: Cascade nên các ca trực tổng hợp tự dọn theo. */
  deleteManyByIds(
    ids: string[],
    db: Db = this.prisma,
  ): Promise<Prisma.BatchPayload> {
    if (ids.length === 0) return Promise.resolve({ count: 0 });
    return db.user.deleteMany({ where: { id: { in: ids } } });
  }
}