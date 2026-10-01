import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('staff roles migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../prisma/migrations/20261001110000_staff_roles/migration.sql'),
    'utf8',
  );

  it.each(['NURSE', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'PHARMACIST', 'CASHIER'])(
    'adds the %s identity role',
    (role) => expect(sql).toContain(`'${role}'`),
  );

  it('does not grant business permissions or touch routing data', () => {
    expect(sql).not.toMatch(/INSERT INTO `role_permissions`/i);
    expect(sql).not.toMatch(/`(?:visits|visit_steps|visit_assignments|routing_queues|room_queue_entries|room_runtimes|visit_tokens)`/i);
    expect(sql).not.toMatch(/\b(?:DROP|DELETE|TRUNCATE)\b/i);
  });
});
