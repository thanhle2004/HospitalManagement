import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('avg process time seconds migration', () => {
  const migrationPath = resolve(
    __dirname,
    '../../prisma/migrations/20260928080000_avg_process_time_seconds/migration.sql',
  );
  const migrationSql = readFileSync(migrationPath, 'utf8').replace(/\s+/g, ' ');

  it('atomically multiplies both persisted minute values by 60', () => {
    expect(migrationSql).toMatch(/START TRANSACTION;/i);
    expect(migrationSql).toMatch(
      /UPDATE `room_types` SET `avg_process_time` = `avg_process_time` \* 60 WHERE `avg_process_time` IS NOT NULL;/i,
    );
    expect(migrationSql).toMatch(
      /UPDATE `rooms` SET `avg_process_time` = `avg_process_time` \* 60 WHERE `avg_process_time` IS NOT NULL;/i,
    );
    expect(migrationSql).toMatch(/COMMIT;/i);
  });

  it('does not remove either source table or its data', () => {
    expect(migrationSql).not.toMatch(/\b(?:DELETE|DROP|TRUNCATE)\b/i);
  });
});
