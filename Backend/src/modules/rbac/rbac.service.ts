import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AssignRoleDto, CreateRoleDto, RbacPaginationDto, StaffQueryDto, UpdateRoleDto } from './dto/rbac.dto';
import { RbacRepository } from './rbac.repository';

export interface RbacAuditContext {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type StaffWorkspace = 'ADMIN' | 'DOCTOR';

export interface EffectiveAccess {
  effectiveRoles: string[];
  effectivePermissions: string[];
  workspace: StaffWorkspace | null;
}

@Injectable()
export class RbacService {
  constructor(
    private readonly repository: RbacRepository,
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async userHasEveryPermission(userId: string, required: string[], legacyRole?: UserRole): Promise<boolean> {
    const codes = new Set((await this.repository.findPermissionCodesForUser(userId)).map((item) => item.code));
    // Compatibility safety net until every existing user has been backfilled.
    if (legacyRole === UserRole.ADMIN && required.every((code) => code === 'rbac.manage')) return true;
    return required.every((code) => codes.has(code));
  }

  async getEffectiveAccess(
    userId: string,
    legacyRole: UserRole,
  ): Promise<EffectiveAccess> {
    const assignments = await this.repository.listUserRoles(userId);
    const effectiveRoles = assignments
      .map((assignment) => assignment.role.code)
      .sort();
    const effectivePermissions = [
      ...new Set(
        assignments.flatMap((assignment) =>
          assignment.role.permissions.map((link) => link.permission.code),
        ),
      ),
    ].sort();

    return {
      effectiveRoles,
      effectivePermissions,
      workspace: this.selectWorkspace(effectiveRoles, legacyRole),
    };
  }

  async listPermissions(query: RbacPaginationDto) {
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.repository.listPermissions(skip, query.limit),
      this.repository.countPermissions(),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async listRoles(query: RbacPaginationDto) {
    const skip = (query.page - 1) * query.limit;
    const [roles, total] = await Promise.all([
      this.repository.listRoles(skip, query.limit),
      this.repository.countRoles(),
    ]);
    return { items: roles.map((role) => this.mapRole(role)), total, page: query.page, limit: query.limit };
  }

  async listStaff(query: StaffQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.repository.listStaff(skip, query.limit, query.search, query.status),
      this.repository.countStaff(query.search, query.status),
    ]);
    return {
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        legacyRole: user.role,
        status: user.status,
        fullName: user.profile?.fullName ?? null,
        phone: user.profile?.phone ?? null,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        roles: user.roleAssignments.map((assignment) => assignment.role.code),
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async createRole(actorId: string, dto: CreateRoleDto, context: RbacAuditContext = {}) {
    if (await this.repository.findRoleByCode(dto.code)) throw new ConflictException('Mã vai trò đã tồn tại');
    const permissions = await this.resolvePermissions(dto.permissionCodes);
    const roleId = await this.prisma.transaction(async (tx) => {
      const role = await this.repository.createRole({ code: dto.code, name: dto.name, description: dto.description }, tx);
      await this.repository.replacePermissions(role.id, permissions.map((item) => item.id), tx);
      await this.activityLog.log({ userId: actorId, action: 'RBAC_ROLE_CREATED', entity: 'Role', entityId: String(role.id), metadata: { requestId: context.requestId, code: role.code, permissionCodes: dto.permissionCodes }, ipAddress: context.ipAddress, userAgent: context.userAgent }, tx);
      return role.id;
    });
    return this.mapRole((await this.repository.findRoleById(roleId))!);
  }

  async updateRole(actorId: string, id: number, dto: UpdateRoleDto, context: RbacAuditContext = {}) {
    const current = await this.repository.findRoleById(id);
    if (!current) throw new NotFoundException(`Role #${id} không tồn tại`);
    const permissions = dto.permissionCodes ? await this.resolvePermissions(dto.permissionCodes) : undefined;
    await this.prisma.transaction(async (tx) => {
      await this.repository.updateRole(id, { name: dto.name, description: dto.description }, tx);
      if (permissions) await this.repository.replacePermissions(id, permissions.map((item) => item.id), tx);
      await this.activityLog.log({ userId: actorId, action: 'RBAC_ROLE_UPDATED', entity: 'Role', entityId: String(id), metadata: { requestId: context.requestId, reason: dto.reason, before: this.mapRole(current), permissionCodes: dto.permissionCodes }, ipAddress: context.ipAddress, userAgent: context.userAgent }, tx);
    });
    return this.mapRole((await this.repository.findRoleById(id))!);
  }

  async listUserRoles(userId: string) {
    await this.assertUser(userId);
    return (await this.repository.listUserRoles(userId)).map((item) => ({
      code: item.role.code,
      name: item.role.name,
      assignedAt: item.assignedAt,
      assignedById: item.assignedById,
      permissions: item.role.permissions.map((link) => link.permission.code).sort(),
    }));
  }

  async assignRole(actorId: string, userId: string, dto: AssignRoleDto, context: RbacAuditContext = {}): Promise<void> {
    await this.assertUser(userId);
    const role = await this.repository.findRoleByCode(dto.roleCode);
    if (!role) throw new NotFoundException(`Role ${dto.roleCode} không tồn tại`);
    await this.prisma.transaction(async (tx) => {
      await this.repository.assignRole(userId, role.id, actorId, tx);
      await this.activityLog.log({ userId: actorId, action: 'RBAC_ROLE_ASSIGNED', entity: 'User', entityId: userId, metadata: { requestId: context.requestId, roleCode: role.code, reason: dto.reason }, ipAddress: context.ipAddress, userAgent: context.userAgent }, tx);
    });
  }

  async revokeRole(actorId: string, userId: string, roleCode: string, reason: string, context: RbacAuditContext = {}): Promise<void> {
    await this.assertUser(userId);
    const role = await this.repository.findRoleByCode(roleCode.toUpperCase());
    if (!role) throw new NotFoundException(`Role ${roleCode} không tồn tại`);
    if ((await this.repository.countUserRoles(userId)) <= 1) throw new BadRequestException('Nhân viên phải còn ít nhất một vai trò');
    if (role.code === 'ADMIN' && (await this.repository.countRoleAssignments(role.id)) <= 1) {
      throw new BadRequestException('Không thể thu hồi vai trò ADMIN cuối cùng');
    }
    await this.prisma.transaction(async (tx) => {
      const deleted = await this.repository.revokeRole(userId, role.id, tx);
      if (!deleted.count) throw new NotFoundException('Nhân viên không có vai trò này');
      await this.activityLog.log({ userId: actorId, action: 'RBAC_ROLE_REVOKED', entity: 'User', entityId: userId, metadata: { requestId: context.requestId, roleCode: role.code, reason }, ipAddress: context.ipAddress, userAgent: context.userAgent }, tx);
    });
  }

  private async assertUser(userId: string): Promise<void> {
    const user = await this.repository.findUser(userId);
    if (!user || user.deletedAt) throw new NotFoundException(`User #${userId} không tồn tại`);
  }

  private async resolvePermissions(codes: string[]) {
    const unique = [...new Set(codes)];
    const permissions = await this.repository.findPermissionsByCodes(unique);
    if (permissions.length !== unique.length) {
      const found = new Set(permissions.map((item) => item.code));
      throw new BadRequestException(`Permission không tồn tại: ${unique.filter((code) => !found.has(code)).join(', ')}`);
    }
    return permissions;
  }

  private selectWorkspace(
    effectiveRoles: string[],
    legacyRole: UserRole,
  ): StaffWorkspace | null {
    if (
      (legacyRole === UserRole.ADMIN || legacyRole === UserRole.DOCTOR) &&
      (effectiveRoles.includes(legacyRole) || effectiveRoles.length === 0)
    ) {
      return legacyRole;
    }
    if (effectiveRoles.includes(UserRole.ADMIN)) return 'ADMIN';
    if (effectiveRoles.includes(UserRole.DOCTOR)) return 'DOCTOR';
    return null;
  }

  private mapRole(role: NonNullable<Awaited<ReturnType<RbacRepository['findRoleById']>>>) {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((link) => link.permission.code).sort(),
      assignedUserCount: role._count.assignments,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
