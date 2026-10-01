import { ActivityLogController } from './activity-log.controller';
import { ActivityLogService } from './activity-log.service';
import { AUDIT_ACTION_CATALOG, AuditAction, AuditMetadataSchema } from './audit-action.catalog';
import { AUDIT_RETENTION_CONTRACT } from './audit-retention.policy';
import { PERMISSIONS_KEY } from '../rbac/decorators/permissions.decorator';

describe('Audit policy platform', () => {
  const repository = { create: jest.fn(), findAll: jest.fn(), count: jest.fn() };
  const service = new ActivityLogService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it('uses a stable machine-queryable action catalog', () => {
    expect(Object.keys(AUDIT_ACTION_CATALOG).length).toBeGreaterThan(10);
    for (const [action, policy] of Object.entries(AUDIT_ACTION_CATALOG)) {
      expect(action).toMatch(/^[A-Z][A-Z0-9_]+$/);
      expect(policy.resource).toMatch(/^[A-Z][A-Za-z0-9]+$/);
    }
  });

  it('accepts bounded scalar metadata and rejects nested request payloads', () => {
    expect(AuditMetadataSchema.parse({ requestId: 'req-1', effectiveRoles: ['ADMIN'] })).toEqual({ requestId: 'req-1', effectiveRoles: ['ADMIN'] });
    expect(() => AuditMetadataSchema.parse({ request: { body: { fullName: 'Patient' } } })).toThrow();
  });

  it.each(['password', 'refreshToken', 'otp', 'qrSecret', 'credential'])('deny-lists sensitive metadata key %s', (key) => {
    expect(() => AuditMetadataSchema.parse({ [key]: 'must-not-persist' })).toThrow('Sensitive audit metadata key is forbidden');
  });

  it('enforces action/resource and required-reason policy before persistence', async () => {
    await expect(service.log({ action: AuditAction.RBAC_ROLE_ASSIGNED, entity: 'Role', entityId: '1', metadata: { reason: 'x' } })).rejects.toThrow('requires resource User');
    await expect(service.log({ action: AuditAction.RBAC_ROLE_ASSIGNED, entity: 'User', entityId: '1', metadata: {} })).rejects.toThrow('requires reason metadata');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('records sensitive-read actor roles without copying filter values', async () => {
    repository.create.mockResolvedValue({});
    await service.logSensitiveRead({ userId: 'actor-1', action: AuditAction.PATIENT_RECORDS_READ, entity: 'Patient', entityId: '*', effectiveRoles: ['DOCTOR', 'ADMIN'], requestId: 'req-1', filterFields: ['page', 'search'], resultCount: 2 });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { requestId: 'req-1', effectiveRoles: ['ADMIN', 'DOCTOR'], filterFields: ['page', 'search'], resultCount: 2 },
    }), undefined);
    expect(JSON.stringify(repository.create.mock.calls)).not.toContain('patient@example');
  });

  it('rejects a non-sensitive action through the sensitive-read hook', async () => {
    await expect(service.logSensitiveRead({ userId: 'actor-1', action: AuditAction.STAFF_PROFILE_UPDATED, entity: 'User', entityId: 'actor-1', effectiveRoles: [] })).rejects.toThrow('not a sensitive-read policy');
  });

  it('supports deterministic pagination and action/resource/actor/date filters', async () => {
    repository.findAll.mockResolvedValue([]);
    repository.count.mockResolvedValue(0);
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-02-01T00:00:00Z');
    await service.findAll({ action: AuditAction.RBAC_ROLE_ASSIGNED, entity: 'User', entityId: 'u-1', userId: 'a-1', from, to, page: 2, limit: 10 });
    const filter = { action: AuditAction.RBAC_ROLE_ASSIGNED, entity: 'User', entityId: 'u-1', userId: 'a-1', createdAt: { gte: from, lte: to } };
    expect(repository.findAll).toHaveBeenCalledWith(filter, 10, 10);
    expect(repository.count).toHaveBeenCalledWith(filter);
  });

  it('keeps authentication-failure audit best-effort to preserve anti-enumeration behavior', async () => {
    repository.create.mockRejectedValue(new Error('database unavailable'));
    await expect(service.logBestEffort({ action: AuditAction.AUTHENTICATION_FAILED, entity: 'AuthenticationAttempt', entityId: 'fingerprint' })).resolves.toBeUndefined();
  });

  it('protects the audit query with audit.read', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ActivityLogController)).toEqual(['audit.read']);
  });

  it('documents retention without enabling automatic deletion', () => {
    expect(AUDIT_RETENTION_CONTRACT).toEqual({ minimumDays: 2555, deletionMode: 'EXPLICIT_APPROVAL_ONLY', archiveBeforeDelete: true });
  });
});
