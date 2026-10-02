import { expect, Page, test } from '@playwright/test';

const admin = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@test.local', role: 'ADMIN', status: 'ACTIVE', lastLoginAt: null, createdAt: '2026-01-01T00:00:00.000Z', profile: { fullName: 'Admin', phone: null, avatarUrl: null, gender: null, birthday: null, address: null, description: null }, effectiveRoles: ['ADMIN'], effectivePermissions: ['simulation.manage'], workspace: 'ADMIN' };

function result(algorithm = 'SYSTEM') {
  return { algorithm, algorithmLabel: algorithm === 'SYSTEM' ? 'System Algorithm — Min Estimated Waiting Time' : algorithm, seed: 20261002, workflow: 'SEQUENTIAL', processingProfile: 'HETEROGENEOUS', scenarioId: 'SCN-ABC123', services: [{ id: 'SERVICE_A', dependencies: [], expectedAverageProcessTimeSeconds: 300, rooms: ['ROOM_A_1', 'ROOM_A_2'] }, { id: 'SERVICE_B', dependencies: ['SERVICE_A'], expectedAverageProcessTimeSeconds: 600, rooms: ['ROOM_B_1', 'ROOM_B_2'] }], patientCount: 100, simulationTimeMs: 100000, metrics: { averageWaitingTimeMs: algorithm === 'SYSTEM' ? 12000 : 18000, p95WaitingTimeMs: 30000, maxWaitingTimeMs: 35000, averageLengthOfStayMs: 90000, throughputPerSimHour: 40, averageRoomUtilizationPct: 72, completedPatientCount: 100 }, rooms: [{ roomId: 'ROOM_A_1', serviceId: 'SERVICE_A', patientsServed: 50, busyTimeMs: 72000, utilizationPct: 72 }], events: [{ simTimeMs: 100000, type: 'PATIENT_COMPLETED', patientId: 'P100' }] };
}

async function setup(page: Page, options?: { fail?: boolean; delay?: number }) {
  await page.context().addCookies([{ name: 'hm_staff_access', value: 'benchmark-e2e', url: 'http://localhost:3001' }]);
  await page.route('**/api/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, statusCode: 200, data: admin }) }));
  await page.route('**/api/backend/admin/simulation/runs', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, statusCode: 200, data: [] }) }));
  await page.route('**/api/backend/simulation/benchmark/**', async (route) => {
    if (options?.delay) await new Promise((resolve) => setTimeout(resolve, options.delay));
    if (options?.fail) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, statusCode: 500, message: 'failure' }) });
    const compare = route.request().url().endsWith('/compare');
    const data = compare ? { scenario: { patientCount: 100, workflow: 'SEQUENTIAL', processingProfile: 'HETEROGENEOUS', seed: 20261002, schemaVersion: 1, scenarioId: 'SCN-ABC123', services: result().services }, results: [result(), result('SHORTEST_QUEUE'), result('ROUND_ROBIN')] } : result();
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, statusCode: 201, data }) });
  });
  await page.goto('/admin/simulation');
}

test('single benchmark renders metrics and room visualization', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Run Simulation' }).click();
  await expect(page.getByTestId('benchmark-single-result')).toBeVisible();
  await expect(page.getByTestId('benchmark-single-result').getByText('ROOM_A_1', { exact: true })).toBeVisible();
  await expect(page.getByText('SCN-ABC123')).toBeVisible();
  await expect(page.getByText('Avg Step Wait')).toBeVisible();
});

test('shows reproducible scenario structure before running', async ({ page }) => {
  await setup(page);
  const scenario = page.getByTestId('scenario-structure');
  await expect(scenario).toContainText('Seed: 20261002');
  await expect(scenario).toContainText('Heterogeneous Services');
  await expect(scenario).toContainText('A → B → C → D');
  await expect(scenario).toContainText('Expected processing time: 5.0 min');
  await expect(scenario).toContainText('ROOM_A_1, ROOM_A_2');
});

test('compare mode renders comparison table and identifies System without declaring a winner', async ({ page }) => {
  await setup(page);
  await page.getByLabel('Compare Algorithms').check();
  await page.getByRole('button', { name: 'Compare Algorithms' }).click();
  await expect(page.getByTestId('benchmark-comparison')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'P95 Step Wait' })).toBeVisible();
  await expect(page.getByText('SYSTEM', { exact: true })).toBeVisible();
});

test('shows loading and disables the action while benchmark is running', async ({ page }) => {
  await setup(page, { delay: 700 });
  const button = page.getByRole('button', { name: 'Run Simulation' });
  await button.click();
  await expect(button).toBeDisabled();
  await expect(page.getByTestId('benchmark-single-result')).toBeVisible();
});

test('shows a bounded error state and allows retry', async ({ page }) => {
  await setup(page, { fail: true });
  await page.getByRole('button', { name: 'Run Simulation' }).click();
  await expect(page.getByText('Benchmark failed. Please retry.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Simulation' })).toBeEnabled();
});
