import { requireIsolatedDatabaseUrl } from './isolated-database.guard';

describe('isolated system-test database guard', () => {
  const developerUrl = 'mysql://root:secret@localhost:3306/hospital_management';

  it('rejects a missing E2E database', () => {
    expect(() => requireIsolatedDatabaseUrl(developerUrl, undefined)).toThrow(
      'E2E_DATABASE_URL is required',
    );
  });

  it('rejects the developer database outside CI', () => {
    expect(() => requireIsolatedDatabaseUrl(developerUrl, developerUrl)).toThrow(
      'must differ from DATABASE_URL',
    );
  });

  it('rejects a database without an explicit test suffix', () => {
    expect(() =>
      requireIsolatedDatabaseUrl(
        developerUrl,
        'mysql://root:secret@localhost:3306/hospital_management_shadow',
      ),
    ).toThrow('must end with _e2e or _test');
  });

  it('accepts a dedicated local E2E database', () => {
    const e2eUrl = 'mysql://root:secret@localhost:3306/hospital_management_e2e';
    expect(requireIsolatedDatabaseUrl(developerUrl, e2eUrl)).toBe(e2eUrl);
  });

  it('accepts the ephemeral CI test database even when both variables match', () => {
    const ciUrl = 'mysql://root:secret@localhost:3306/hospital_management_test';
    expect(requireIsolatedDatabaseUrl(ciUrl, ciUrl, true)).toBe(ciUrl);
  });
});
