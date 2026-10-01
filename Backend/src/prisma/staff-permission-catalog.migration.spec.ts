import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('staff permission catalog migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../prisma/migrations/20261001100000_staff_permission_catalog/migration.sql'),
    'utf8',
  );

  it('preserves the legacy ADMIN and DOCTOR authorization split', () => {
    expect(sql).toContain("r.`code` = 'ADMIN'");
    expect(sql).toContain("r.`code` = 'DOCTOR'");
    expect(sql).toContain("'doctor.workflow'");
    expect(sql).toContain("'visits.steps.manage'");
    const adminMapping = sql.slice(sql.indexOf("r.`code` = 'ADMIN'"), sql.indexOf("r.`code` = 'DOCTOR'"));
    expect(adminMapping).not.toContain("'doctor.workflow'");
    expect(adminMapping).not.toContain("'visits.steps.manage'");
  });

  it('is additive and does not alter routing tables', () => {
    expect(sql).not.toMatch(/\b(?:DROP|DELETE|TRUNCATE|ALTER)\b/i);
    expect(sql).not.toMatch(/`(?:visits|visit_steps|visit_assignments|routing_queues|room_queue_entries|room_runtimes|visit_tokens)`/i);
  });
});
