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
    return db.user.update({ where: { id }, data: { status } });
  }

  updatePassword(id: string, passwordHash: string, db: Db = this.prisma): Promise<User> {
    return db.user.update({ where: { id }, data: { passwordHash } });
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
}
