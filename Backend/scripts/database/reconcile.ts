import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

type Severity = 'error' | 'warning';
type Check = {
  id: string;
  severity: Severity;
  description: string;
  sql: string;
};

const checks: Check[] = [
  {
    id: 'patient_type_soft_deleted_in_use',
    severity: 'warning',
    description: 'Patients reference a soft-deleted patient type',
    sql: `SELECT COUNT(*) AS issueCount
          FROM patients p
          JOIN patient_types pt ON pt.id = p.patient_type_id
          WHERE pt.deleted_at IS NOT NULL`,
  },
  {
    id: 'canonical_phone_duplicates',
    severity: 'warning',
    description: 'Patient phones collide after punctuation/space normalization',
    sql: `SELECT COUNT(*) AS issueCount
          FROM (
            SELECT REGEXP_REPLACE(phone, '[^0-9]', '') AS canonical_phone
            FROM patients
            GROUP BY canonical_phone
            HAVING COUNT(*) > 1
          ) duplicate_groups`,
  },
  {
    id: 'canonical_staff_email_duplicates',
    severity: 'warning',
    description: 'Staff emails collide after trim/lowercase normalization',
    sql: `SELECT COUNT(*) AS issueCount
          FROM (
            SELECT LOWER(TRIM(email)) AS canonical_email
            FROM users
            GROUP BY canonical_email
            HAVING COUNT(*) > 1
          ) duplicate_groups`,
  },
  {
    id: 'negative_token_versions',
    severity: 'error',
    description: 'Auth principals contain a negative token version',
    sql: `SELECT
            (SELECT COUNT(*) FROM users WHERE token_version < 0) +
            (SELECT COUNT(*) FROM patients WHERE token_version < 0) +
            (SELECT COUNT(*) FROM devices WHERE token_version < 0)
            AS issueCount`,
  },
  {
    id: 'duplicate_active_staff_refresh_hashes',
    severity: 'error',
    description: 'Multiple active Staff refresh rows share the same token hash',
    sql: `SELECT COUNT(*) AS issueCount
          FROM (
            SELECT token_hash
            FROM refresh_tokens
            WHERE revoked_at IS NULL AND expires_at > NOW()
            GROUP BY token_hash
            HAVING COUNT(*) > 1
          ) duplicate_groups`,
  },
  {
    id: 'duplicate_active_patient_refresh_hashes',
    severity: 'error',
    description: 'Multiple active Patient sessions share the same refresh hash',
    sql: `SELECT COUNT(*) AS issueCount
          FROM (
            SELECT refresh_token_hash
            FROM patient_sessions
            WHERE revoked_at IS NULL AND expires_at > NOW()
            GROUP BY refresh_token_hash
            HAVING COUNT(*) > 1
          ) duplicate_groups`,
  },
  {
    id: 'inactive_user_has_active_refresh',
    severity: 'error',
    description: 'Inactive or locked Staff still has an active refresh row',
    sql: `SELECT COUNT(*) AS issueCount
          FROM refresh_tokens rt
          JOIN users u ON u.id = rt.user_id
          WHERE rt.revoked_at IS NULL
            AND rt.expires_at > NOW()
            AND u.status <> 'ACTIVE'`,
  },
  {
    id: 'flow_dependency_self_reference',
    severity: 'error',
    description: 'Flow dependency points to itself',
    sql: `SELECT COUNT(*) AS issueCount
          FROM flow_dependencies
          WHERE step_id = required_step_id`,
  },
  {
    id: 'flow_dependency_cross_flow',
    severity: 'error',
    description: 'Flow dependency connects steps from different flows',
    sql: `SELECT COUNT(*) AS issueCount
          FROM flow_dependencies fd
          JOIN flow_steps target_step ON target_step.id = fd.step_id
          JOIN flow_steps required_step ON required_step.id = fd.required_step_id
          WHERE target_step.flow_id <> required_step.flow_id`,
  },
  {
    id: 'visit_dependency_self_reference',
    severity: 'error',
    description: 'Visit-step dependency points to itself',
    sql: `SELECT COUNT(*) AS issueCount
          FROM visit_step_dependencies
          WHERE step_id = required_step_id`,
  },
  {
    id: 'visit_dependency_cross_visit',
    severity: 'error',
    description: 'Visit-step dependency connects steps from different visits',
    sql: `SELECT COUNT(*) AS issueCount
          FROM visit_step_dependencies vd
          JOIN visit_steps target_step ON target_step.id = vd.step_id
          JOIN visit_steps required_step ON required_step.id = vd.required_step_id
          WHERE target_step.visit_id <> required_step.visit_id`,
  },
  {
    id: 'ad_hoc_shape_mismatch',
    severity: 'error',
    description: 'Ad-hoc marker disagrees with the source flow-step reference',
    sql: `SELECT COUNT(*) AS issueCount
          FROM visit_steps
          WHERE (is_ad_hoc = 1 AND flow_step_id IS NOT NULL)
             OR (is_ad_hoc = 0 AND flow_step_id IS NULL)`,
  },
  {
    id: 'completed_visit_has_open_steps',
    severity: 'error',
    description: 'Completed visit still has a non-terminal step',
    sql: `SELECT COUNT(DISTINCT v.id) AS issueCount
          FROM visits v
          JOIN visit_steps vs ON vs.visit_id = v.id
          WHERE v.status = 'COMPLETED'
            AND vs.status NOT IN ('COMPLETED', 'SKIPPED', 'CANCELLED')`,
  },
  {
    id: 'visit_terminal_timestamp_mismatch',
    severity: 'error',
    description: 'Visit terminal status and terminal timestamp disagree',
    sql: `SELECT COUNT(*) AS issueCount
          FROM visits
          WHERE (status = 'COMPLETED' AND completed_at IS NULL)
             OR (status <> 'COMPLETED' AND completed_at IS NOT NULL)
             OR (status = 'CANCELLED' AND cancelled_at IS NULL)
             OR (status <> 'CANCELLED' AND cancelled_at IS NOT NULL)`,
  },
  {
    id: 'visit_step_terminal_timestamp_mismatch',
    severity: 'error',
    description: 'Visit-step completion status and timestamp disagree',
    sql: `SELECT COUNT(*) AS issueCount
          FROM visit_steps
          WHERE (status = 'COMPLETED' AND completed_at IS NULL)
             OR (status <> 'COMPLETED' AND completed_at IS NOT NULL)`,
  },
  {
    id: 'assignment_timestamp_mismatch',
    severity: 'error',
    description: 'Assignment status and lifecycle timestamps disagree',
    sql: `SELECT COUNT(*) AS issueCount
          FROM visit_assignments
          WHERE (status = 'CHECKED_IN' AND checked_in_at IS NULL)
             OR (status = 'IN_PROGRESS' AND (checked_in_at IS NULL OR started_at IS NULL))
             OR (status = 'COMPLETED' AND completed_at IS NULL)
             OR (status = 'CANCELLED' AND (cancelled_at IS NULL OR cancel_reason IS NULL))
             OR (status <> 'COMPLETED' AND completed_at IS NOT NULL)
             OR (status <> 'CANCELLED' AND cancelled_at IS NOT NULL)`,
  },
  {
    id: 'multiple_active_assignments_per_step',
    severity: 'error',
    description: 'A visit step has more than one active room assignment',
    sql: `SELECT COUNT(*) AS issueCount
          FROM (
            SELECT visit_step_id
            FROM visit_assignments
            WHERE status IN ('WAITING', 'CHECKED_IN', 'IN_PROGRESS')
            GROUP BY visit_step_id
            HAVING COUNT(*) > 1
          ) duplicate_active_assignments`,
  },
  {
    id: 'queue_assignment_state_mismatch',
    severity: 'error',
    description:
      'Room queue contains an assignment outside the checked-in/exam lifecycle',
    sql: `SELECT COUNT(*) AS issueCount
          FROM room_queue_entries rqe
          JOIN visit_assignments va ON va.id = rqe.visit_assignment_id
          WHERE va.status NOT IN ('CHECKED_IN', 'IN_PROGRESS')`,
  },
  {
    id: 'queue_room_mismatch',
    severity: 'error',
    description: 'Queue room differs from its assignment room',
    sql: `SELECT COUNT(*) AS issueCount
          FROM room_queue_entries rqe
          JOIN visit_assignments va ON va.id = rqe.visit_assignment_id
          WHERE rqe.room_id <> va.room_id`,
  },
  {
    id: 'runtime_assignment_state_mismatch',
    severity: 'error',
    description: 'Room runtime points to an assignment that is not in progress',
    sql: `SELECT COUNT(*) AS issueCount
          FROM room_runtimes rr
          JOIN visit_assignments va ON va.id = rr.current_visit_assignment_id
          WHERE rr.current_visit_assignment_id IS NOT NULL
            AND (va.status <> 'IN_PROGRESS' OR va.room_id <> rr.room_id)`,
  },
  {
    id: 'in_progress_assignment_missing_runtime',
    severity: 'error',
    description: 'In-progress assignment is not the active assignment of its room',
    sql: `SELECT COUNT(*) AS issueCount
          FROM visit_assignments va
          LEFT JOIN room_runtimes rr
            ON rr.room_id = va.room_id
            AND rr.current_visit_assignment_id = va.id
          WHERE va.status = 'IN_PROGRESS' AND rr.room_id IS NULL`,
  },
  {
    id: 'doctor_assignment_wrong_role',
    severity: 'error',
    description: 'Doctor assignment references a non-doctor user',
    sql: `SELECT COUNT(*) AS issueCount
          FROM doctor_assignments da
          JOIN users u ON u.id = da.doctor_id
          WHERE u.role <> 'DOCTOR'`,
  },
  {
    id: 'doctor_assignment_invalid_interval',
    severity: 'error',
    description: 'Doctor shift ends before or at its start time',
    sql: `SELECT COUNT(*) AS issueCount
          FROM doctor_assignments
          WHERE end_time IS NOT NULL AND end_time <= start_time`,
  },
  {
    id: 'doctor_assignment_overlap',
    severity: 'error',
    description: 'A doctor has overlapping shifts',
    sql: `SELECT COUNT(*) AS issueCount
          FROM doctor_assignments first_shift
          JOIN doctor_assignments second_shift
            ON first_shift.doctor_id = second_shift.doctor_id
            AND first_shift.id < second_shift.id
            AND first_shift.start_time < COALESCE(second_shift.end_time, '9999-12-31')
            AND second_shift.start_time < COALESCE(first_shift.end_time, '9999-12-31')`,
  },
  {
    id: 'maintenance_room_has_live_work',
    severity: 'warning',
    description: 'Maintenance room still has queued or in-progress work',
    sql: `SELECT COUNT(DISTINCT r.id) AS issueCount
          FROM rooms r
          LEFT JOIN room_queue_entries rqe ON rqe.room_id = r.id
          LEFT JOIN room_runtimes rr ON rr.room_id = r.id
          WHERE r.status = 'MAINTENANCE'
            AND (rqe.id IS NOT NULL OR rr.current_visit_assignment_id IS NOT NULL)`,
  },
];

const prisma = new PrismaClient();

const stringify = (value: unknown): string =>
  JSON.stringify(
    value,
    (_key, current) =>
      typeof current === 'bigint' ? current.toString() : current,
    2,
  );

async function main(): Promise<void> {
  const outputDirectory = resolve(
    process.argv[2] ?? '../artifacts/db-reconciliation',
  );
  const generatedAt = new Date();
  const results = [];

  for (const check of checks) {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ issueCount: bigint | number }>
    >(check.sql);
    const issueCount = Number(rows[0]?.issueCount ?? 0);
    results.push({
      id: check.id,
      severity: check.severity,
      description: check.description,
      issueCount,
      passed: issueCount === 0,
    });
  }

  const reportWithoutChecksum = {
    formatVersion: 1,
    generatedAt: generatedAt.toISOString(),
    scope: 'aggregate-counts-only',
    summary: {
      checkCount: results.length,
      errorCount: results.filter(
        (result) => !result.passed && result.severity === 'error',
      ).length,
      warningCount: results.filter(
        (result) => !result.passed && result.severity === 'warning',
      ).length,
    },
    results,
  };
  const payload = stringify(reportWithoutChecksum);
  const sha256 = createHash('sha256').update(payload).digest('hex');
  const timestamp = generatedAt.toISOString().replace(/[:.]/g, '-');
  const outputPath = resolve(outputDirectory, `reconciliation-${timestamp}.json`);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    outputPath,
    `${stringify({ ...reportWithoutChecksum, sha256 })}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );

  process.stdout.write(
    `${stringify({ outputPath, sha256, ...reportWithoutChecksum.summary })}\n`,
  );
  if (reportWithoutChecksum.summary.errorCount > 0) {
    process.exitCode = 2;
  }
}

main()
  .catch((error: unknown) => {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    process.stderr.write(`Database reconciliation failed (${errorName})\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
