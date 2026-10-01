import { z } from 'zod';

export const AuditAction = {
  AUTHENTICATION_SUCCEEDED: 'AUTHENTICATION_SUCCEEDED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  STAFF_LOGGED_OUT_ALL: 'STAFF_LOGGED_OUT_ALL',
  STAFF_SESSION_REVOKED: 'STAFF_SESSION_REVOKED',
  STAFF_OTHER_SESSIONS_REVOKED: 'STAFF_OTHER_SESSIONS_REVOKED',
  STAFF_CREATED: 'STAFF_CREATED',
  STAFF_STATUS_CHANGED: 'STAFF_STATUS_CHANGED',
  STAFF_PROFILE_UPDATED: 'STAFF_PROFILE_UPDATED',
  STAFF_PASSWORD_CHANGED: 'STAFF_PASSWORD_CHANGED',
  STAFF_DIRECTORY_READ: 'STAFF_DIRECTORY_READ',
  RBAC_ROLE_CREATED: 'RBAC_ROLE_CREATED',
  RBAC_ROLE_UPDATED: 'RBAC_ROLE_UPDATED',
  RBAC_ROLE_ASSIGNED: 'RBAC_ROLE_ASSIGNED',
  RBAC_ROLE_REVOKED: 'RBAC_ROLE_REVOKED',
  PATIENT_TYPE_UPDATED: 'PATIENT_TYPE_UPDATED',
  PATIENT_RECORD_READ: 'PATIENT_RECORD_READ',
  PATIENT_RECORDS_READ: 'PATIENT_RECORDS_READ',
  ROOM_QUEUE_MOVE_TO_FRONT: 'ROOM_QUEUE_MOVE_TO_FRONT',
  ROOM_QUEUE_MOVE_AFTER: 'ROOM_QUEUE_MOVE_AFTER',
} as const;

export type AuditActionCode = typeof AuditAction[keyof typeof AuditAction];

const scalar = z.union([z.string().max(500), z.number(), z.boolean(), z.null()]);
export const AuditMetadataSchema = z.record(
  z.string().max(80),
  z.union([scalar, z.array(scalar).max(100)]),
).superRefine((metadata, context) => {
  for (const key of Object.keys(metadata)) {
    if (/(password|passphrase|secret|token|otp|credential|clinicalNote|payment)/i.test(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Sensitive audit metadata key is forbidden' });
    }
  }
});

export interface AuditActionPolicy {
  resource: string;
  category: 'AUTHENTICATION' | 'AUTHORIZATION' | 'IDENTITY' | 'PATIENT' | 'ROUTING';
  sensitiveRead?: boolean;
  reasonRequired?: boolean;
}

export const AUDIT_ACTION_CATALOG: Record<AuditActionCode, AuditActionPolicy> = {
  AUTHENTICATION_SUCCEEDED: { resource: 'User', category: 'AUTHENTICATION' },
  AUTHENTICATION_FAILED: { resource: 'AuthenticationAttempt', category: 'AUTHENTICATION' },
  STAFF_LOGGED_OUT_ALL: { resource: 'User', category: 'AUTHENTICATION' },
  STAFF_SESSION_REVOKED: { resource: 'RefreshToken', category: 'AUTHENTICATION' },
  STAFF_OTHER_SESSIONS_REVOKED: { resource: 'User', category: 'AUTHENTICATION' },
  STAFF_CREATED: { resource: 'User', category: 'IDENTITY', reasonRequired: true },
  STAFF_STATUS_CHANGED: { resource: 'User', category: 'IDENTITY', reasonRequired: true },
  STAFF_PROFILE_UPDATED: { resource: 'User', category: 'IDENTITY' },
  STAFF_PASSWORD_CHANGED: { resource: 'User', category: 'AUTHENTICATION' },
  STAFF_DIRECTORY_READ: { resource: 'User', category: 'IDENTITY', sensitiveRead: true },
  RBAC_ROLE_CREATED: { resource: 'Role', category: 'AUTHORIZATION' },
  RBAC_ROLE_UPDATED: { resource: 'Role', category: 'AUTHORIZATION', reasonRequired: true },
  RBAC_ROLE_ASSIGNED: { resource: 'User', category: 'AUTHORIZATION', reasonRequired: true },
  RBAC_ROLE_REVOKED: { resource: 'User', category: 'AUTHORIZATION', reasonRequired: true },
  PATIENT_TYPE_UPDATED: { resource: 'Patient', category: 'PATIENT' },
  PATIENT_RECORD_READ: { resource: 'Patient', category: 'PATIENT', sensitiveRead: true },
  PATIENT_RECORDS_READ: { resource: 'Patient', category: 'PATIENT', sensitiveRead: true },
  ROOM_QUEUE_MOVE_TO_FRONT: { resource: 'RoomQueueEntry', category: 'ROUTING' },
  ROOM_QUEUE_MOVE_AFTER: { resource: 'RoomQueueEntry', category: 'ROUTING' },
};

export function isAuditAction(value: string): value is AuditActionCode {
  return Object.prototype.hasOwnProperty.call(AUDIT_ACTION_CATALOG, value);
}
