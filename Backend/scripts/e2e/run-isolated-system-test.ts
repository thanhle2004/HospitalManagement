import { spawn, spawnSync } from 'node:child_process';
import { requireIsolatedDatabaseUrl } from '../../src/contract-harness/isolated-database.guard';

const databaseUrl = process.env.DATABASE_URL;
const e2eDatabaseUrl = requireIsolatedDatabaseUrl(
  databaseUrl,
  process.env.E2E_DATABASE_URL,
  process.env.CI === 'true',
);

const env = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: '3100',
  DATABASE_URL: e2eDatabaseUrl,
  SYSTEM_TEST_API_URL: 'http://127.0.0.1:3100',
  SEED_ADMIN_EMAIL: 'admin@hospital.local',
  SEED_ADMIN_PASSWORD: 'ChangeMe123!',
  SYSTEM_TEST_ADMIN_EMAIL: 'admin@hospital.local',
  SYSTEM_TEST_ADMIN_PASSWORD: 'ChangeMe123!',
  SYSTEM_TEST_DOCTOR_PASSWORD: 'Doctor123!',
  SYSTEM_TEST_SCANNER_SECRET: 'Scanner123!',
};

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { env, shell: true, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function waitForHealth(): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:3100/health/ready');
      if (response.ok) return;
    } catch {
      // Backend can refuse connections while migrations/startup are still completing.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Isolated backend did not become ready');
}

async function main(): Promise<void> {
  run('npx', ['prisma', 'migrate', 'reset', '--force']);
  run('npm', ['run', 'build']);
  const backend = spawn('npm', ['run', 'start:prod'], { env, shell: true, stdio: 'inherit' });
  try {
    await waitForHealth();
    run('npm', ['run', 'test:system']);
  } finally {
    backend.kill('SIGTERM');
  }
}

void main();
