export function requireIsolatedDatabaseUrl(
  databaseUrl: string | undefined,
  e2eDatabaseUrl: string | undefined,
  isCi = false,
): string {
  if (!e2eDatabaseUrl) {
    throw new Error('E2E_DATABASE_URL is required; developer database is never used');
  }

  if (!isCi && e2eDatabaseUrl === databaseUrl) {
    throw new Error('E2E_DATABASE_URL must differ from DATABASE_URL outside CI');
  }

  const databaseName = new URL(e2eDatabaseUrl).pathname.replace(/^\//, '');
  if (!/(_e2e|_test)$/i.test(databaseName)) {
    throw new Error('E2E database name must end with _e2e or _test');
  }

  return e2eDatabaseUrl;
}
