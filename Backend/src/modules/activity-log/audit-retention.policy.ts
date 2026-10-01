export const DEFAULT_AUDIT_RETENTION_DAYS = 2555;

export interface AuditRetentionContract {
  minimumDays: number;
  deletionMode: 'EXPLICIT_APPROVAL_ONLY';
  archiveBeforeDelete: true;
}

export const AUDIT_RETENTION_CONTRACT: AuditRetentionContract = {
  minimumDays: DEFAULT_AUDIT_RETENTION_DAYS,
  deletionMode: 'EXPLICIT_APPROVAL_ONLY',
  archiveBeforeDelete: true,
};
