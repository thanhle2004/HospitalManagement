import { Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class RbacRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPermissionCodesForUser(userId: string, db: Db = this.prisma): Promise<Array<{ code: string }>> {
    return db.permission.findMany({
      where: { roles: { some: { role: { assignments: { some: { userId } } } } } },
      select: { code: true },
    });
  }

  listPermissions(skip: number, take: number, db: Db = this.prisma) {
    return db.permission.findMany({ orderBy: { code: 'asc' }, skip, take });
  }

  countPermissions(db: Db = this.prisma): Promise<number> {
    return db.permission.count();
  }

  listRoles(skip: number, take: number, db: Db = this.prisma) {
    return db.role.findMany({
      include: { permissions: { include: { permission: true } }, _count: { select: { assignments: true } } },
      orderBy: { code: 'asc' },
      skip,
      take,
    });
  }

  countRoles(db: Db = this.prisma): Promise<number> {
    return db.role.count();
  }

  listStaff(skip: number, take: number, search?: string, status?: UserStatus, db: Db = this.prisma) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      status,
      ...(search
        ? {
            OR: [
              { email: { contains: search } },
              { profile: { fullName: { contains: search } } },
            ],
          }
        : {}),
    };
    return db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        profile: { select: { fullName: true, phone: true } },
        roleAssignments: { include: { role: true }, orderBy: { assignedAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  countStaff(search?: string, status?: UserStatus, db: Db = this.prisma): Promise<number> {
    return db.user.count({
      where: {
        deletedAt: null,
        status,
        ...(search ? { OR: [{ email: { contains: search } }, { profile: { fullName: { contains: search } } }] } : {}),
      },
    });
  }

  findRoleByCode(code: string, db: Db = this.prisma) {
    return db.role.findUnique({
      where: { code },
      include: { permissions: { include: { permission: true } }, _count: { select: { assignments: true } } },
    });
  }

  findRoleById(id: number, db: Db = this.prisma) {
    return db.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } }, _count: { select: { assignments: true } } },
    });
  }

  findPermissionsByCodes(codes: string[], db: Db = this.prisma) {
    return db.permission.findMany({ where: { code: { in: codes } } });
  }

  createRole(data: Prisma.RoleCreateInput, db: Db = this.prisma) {
    return db.role.create({ data });
  }

  updateRole(id: number, data: Prisma.RoleUpdateInput, db: Db = this.prisma) {
    return db.role.update({ where: { id }, data });
  }

  replacePermissions(roleId: number, permissionIds: number[], db: Db = this.prisma) {
    return Promise.all([
      db.rolePermission.deleteMany({ where: { roleId } }),
      db.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      }),
    ]);
  }

  findUser(userId: string, db: Db = this.prisma) {
    return db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, deletedAt: true } });
  }

  listUserRoles(userId: string, db: Db = this.prisma) {
    return db.userRoleAssignment.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
      orderBy: { assignedAt: 'asc' },
    });
  }

  assignRole(userId: string, roleId: number, assignedById: string, db: Db = this.prisma) {
    return db.userRoleAssignment.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId, assignedById },
      update: {},
    });
  }

  revokeRole(userId: string, roleId: number, db: Db = this.prisma) {
    return db.userRoleAssignment.deleteMany({ where: { userId, roleId } });
  }

  countUserRoles(userId: string, db: Db = this.prisma): Promise<number> {
    return db.userRoleAssignment.count({ where: { userId } });
  }

  countRoleAssignments(roleId: number, db: Db = this.prisma): Promise<number> {
    return db.userRoleAssignment.count({ where: { roleId } });
  }
}
