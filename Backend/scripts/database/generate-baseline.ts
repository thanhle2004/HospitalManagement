import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';

const backendRoot = resolve(__dirname, '../..');
const prismaCli = resolve(backendRoot, 'node_modules/prisma/build/index.js');

function runPrisma(arguments_: string[]) {
  return spawnSync(process.execPath, [prismaCli, ...arguments_], {
    cwd: backendRoot,
    encoding: 'utf8',
    env: process.env,
    shell: false,
  });
}

async function main(): Promise<void> {
  const outputDirectory = resolve(
    process.argv[2] ?? resolve(backendRoot, '../artifacts/db-baseline'),
  );

  const drift = runPrisma([
    'migrate',
    'diff',
    '--from-schema-datasource',
    'prisma/schema.prisma',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--exit-code',
  ]);
  if (drift.error || drift.status !== 0) {
    if (drift.status === 2) {
      process.stderr.write(
        'Baseline draft blocked: live database drift differs from schema.prisma\n',
      );
    } else {
      process.stderr.write('Baseline draft blocked: drift check failed\n');
    }
    process.exitCode = drift.status ?? 1;
    return;
  }

  const baseline = runPrisma([
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
  ]);
  if (baseline.error || baseline.status !== 0 || !baseline.stdout.trim()) {
    process.stderr.write('Baseline SQL generation failed\n');
    process.exitCode = baseline.status ?? 1;
    return;
  }

  const sql = `${baseline.stdout.trim()}\n`;
  const sha256 = createHash('sha256').update(sql).digest('hex');
  const generatedAt = new Date().toISOString();
  await mkdir(outputDirectory, { recursive: true });
  const sqlPath = resolve(outputDirectory, 'current-schema-baseline.sql');
  const manifestPath = resolve(outputDirectory, 'current-schema-baseline.json');

  await writeFile(sqlPath, sql, 'utf8');
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        formatVersion: 1,
        generatedAt,
        status: 'DRAFT_NOT_APPLIED',
        source: 'prisma/schema.prisma after a zero-drift live DB check',
        sha256,
        sqlPath,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  process.stdout.write(
    `${JSON.stringify({ sqlPath, manifestPath, sha256 }, null, 2)}\n`,
  );
}

void main();
