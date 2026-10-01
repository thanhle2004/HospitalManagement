import { expect, Page, test } from '@playwright/test';

type Workspace = 'ADMIN' | 'DOCTOR' | null;

function session(workspace: Workspace, roles: string[]) {
  return {
    id: '11111111-1111-4111-8111-111111111111', email: 'staff@test.local', role: roles[0] ?? 'NURSE', status: 'ACTIVE', lastLoginAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', profile: { fullName: 'Test Staff', phone: null, avatarUrl: null, gender: null, birthday: null, address: null, description: null },
    effectiveRoles: roles, effectivePermissions: [], workspace,
  };
}

async function mockBackend(page: Page, current: ReturnType<typeof session> | null) {
  await page.route('**/api/session', async (route) => {
    if (!current) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, statusCode: 401, message: 'Invalid session' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, statusCode: 200, data: current }) });
  });
  await page.route('**/api/backend/**', async (route) => {
    const data = route.request().url().includes('activity-logs') ? { items: [], total: 0, page: 1, limit: 12 } : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, statusCode: 200, data }) });
  });
}

async function browserSession(page: Page) {
  await page.context().addCookies([{ name: 'hm_staff_access', value: 'deterministic-e2e-cookie', url: 'http://localhost:3001' }]);
}

test('ADMIN session lands in the existing Admin workspace', async ({ page }) => {
  await browserSession(page);
  await mockBackend(page, session('ADMIN', ['ADMIN']));
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Tổng quan hệ thống' })).toBeVisible();
});

test('DOCTOR session lands in the Doctor workspace', async ({ page }) => {
  await browserSession(page);
  await mockBackend(page, session('DOCTOR', ['DOCTOR']));
  await page.goto('/doctor');
  await expect(page).toHaveURL(/\/doctor$/);
  await expect(page.getByRole('heading', { name: 'Hiện chưa đến ca trực' })).toBeVisible();
});

test('role without a completed workspace receives the safe landing', async ({ page }) => {
  await browserSession(page);
  await mockBackend(page, session(null, ['NURSE']));
  await page.goto('/workspace-unavailable');
  await expect(page).toHaveURL(/\/workspace-unavailable$/);
  await expect(page.getByRole('heading', { name: 'Chưa có không gian làm việc' })).toBeVisible();
  await expect(page.getByText('Vai trò: NURSE')).toBeVisible();
});

test('unauthenticated or invalid session cannot render a Staff workspace', async ({ page }) => {
  await mockBackend(page, null);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập hệ thống' })).toBeVisible();
});
