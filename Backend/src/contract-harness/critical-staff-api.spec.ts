import { CanActivate, ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as request from 'supertest';
import { ZodValidationPipe } from 'nestjs-zod';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { ActivityLogController } from '../modules/activity-log/activity-log.controller';
import { ActivityLogService } from '../modules/activity-log/activity-log.service';
import { AuthSessionsController } from '../modules/auth/auth-sessions.controller';
import { AuthService } from '../modules/auth/auth.service';
import { AuthRateLimitService } from '../common/security/auth-rate-limit.service';
import { RbacService } from '../modules/rbac/rbac.service';
import { PermissionsGuard } from '../modules/rbac/guards/permissions.guard';
import { UsersService } from '../modules/users/users.service';

type Actor = 'admin' | 'doctor' | 'multi' | 'nurse' | 'locked' | 'disabled';

const actors: Record<Actor, { id: string; role: UserRole; permissions: string[]; roles: string[]; workspace: 'ADMIN' | 'DOCTOR' | null; active: boolean }> = {
  admin: { id: 'admin-1', role: UserRole.ADMIN, permissions: ['audit.read', 'rbac.manage', 'staff.manage'], roles: ['ADMIN'], workspace: 'ADMIN', active: true },
  doctor: { id: 'doctor-1', role: UserRole.DOCTOR, permissions: ['doctor.workflow'], roles: ['DOCTOR'], workspace: 'DOCTOR', active: true },
  multi: { id: 'multi-1', role: UserRole.NURSE, permissions: ['audit.read', 'doctor.workflow'], roles: ['DOCTOR', 'NURSE'], workspace: 'DOCTOR', active: true },
  nurse: { id: 'nurse-1', role: UserRole.NURSE, permissions: [], roles: ['NURSE'], workspace: null, active: true },
  locked: { id: 'locked-1', role: UserRole.ADMIN, permissions: ['audit.read'], roles: ['ADMIN'], workspace: 'ADMIN', active: false },
  disabled: { id: 'disabled-1', role: UserRole.DOCTOR, permissions: ['doctor.workflow'], roles: ['DOCTOR'], workspace: 'DOCTOR', active: false },
};

class DeterministicStaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-test-actor'] as Actor | undefined;
    const actor = key ? actors[key] : undefined;
    if (!actor || !actor.active) throw new UnauthorizedException('Invalid test session');
    request.user = { sub: actor.id, role: actor.role, tokenVersion: 0, sid: `session-${actor.id}` };
    return true;
  }
}

describe('Critical Staff API authorization and contract harness', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const usersService = {
      findById: jest.fn(async (id: string) => ({ id, email: `${id}@test.local`, role: actors[Object.keys(actors).find((key) => actors[key as Actor].id === id) as Actor].role, status: 'ACTIVE', lastLoginAt: null, createdAt: new Date('2026-01-01'), profile: null })),
    };
    const rbacService = {
      userHasEveryPermission: jest.fn(async (id: string, required: string[]) => {
        const actor = Object.values(actors).find((candidate) => candidate.id === id);
        return !!actor && required.every((permission) => actor.permissions.includes(permission));
      }),
      getEffectiveAccess: jest.fn(async (id: string) => {
        const actor = Object.values(actors).find((candidate) => candidate.id === id)!;
        return { effectiveRoles: actor.roles, effectivePermissions: actor.permissions, workspace: actor.workspace };
      }),
    };
    const module = await Test.createTestingModule({
      controllers: [AuthSessionsController, ActivityLogController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: UsersService, useValue: usersService },
        { provide: AuthRateLimitService, useValue: {} },
        { provide: RbacService, useValue: rbacService },
        { provide: ActivityLogService, useValue: { findAll: jest.fn(async (query) => ({ items: [], total: 0, page: query.page ?? 1, limit: query.limit ?? 20 })) } },
        PermissionsGuard,
        Reflector,
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(new DeterministicStaffGuard(), app.get(PermissionsGuard));
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(() => app.close());

  it.each(['admin', 'doctor', 'multi', 'nurse'] as Actor[])('returns the effective-access contract for active %s Staff', async (actor) => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/sessions/current').set('x-test-actor', actor).expect(200);
    expect(response.body).toEqual(expect.objectContaining({ success: true, data: expect.objectContaining({ effectiveRoles: actors[actor].roles, effectivePermissions: actors[actor].permissions, workspace: actors[actor].workspace }) }));
  });

  it.each(['locked', 'disabled'] as Actor[])('rejects %s Staff before controller execution', async (actor) => {
    await request(app.getHttpServer()).get('/api/v1/auth/sessions/current').set('x-test-actor', actor).expect(401);
  });

  it('rejects unauthenticated and invalid sessions', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/sessions/current').expect(401);
    await request(app.getHttpServer()).get('/api/v1/auth/sessions/current').set('x-test-actor', 'invalid').expect(401);
  });

  it.each([
    ['admin', 200], ['multi', 200], ['doctor', 403], ['nurse', 403],
  ] as Array<[Actor, number]>)('enforces audit.read for %s Staff', async (actor, status) => {
    const response = await request(app.getHttpServer()).get('/activity-logs?page=1&limit=20').set('x-test-actor', actor).expect(status);
    if (status === 200) expect(response.body.data).toEqual({ items: [], total: 0, page: 1, limit: 20 });
  });
});
