/**
 * Test helper: installs a discriminating mock on the shared `query` export so
 * the `authenticate` middleware's account re-check (`SELECT is_active, role
 * FROM users WHERE id = $1`) gets a synthetic user row, while every other SQL
 * statement falls through to a caller-supplied handler (default: empty rows).
 *
 * Never use `mockResolvedValue` for tests that go through `authenticate` —
 * the auth lookup is always the first query and would consume it.
 */
export const installAuthAwareQueryMock = (
  queryMock: jest.Mock,
  authUser: { is_active: boolean; role: string } | null = { is_active: true, role: 'GOVERNMENT_ADMIN' },
  otherQueries?: (sql: string, params?: any[]) => Promise<{ rows: any[] }>,
) => {
  queryMock.mockImplementation((sql: string, params?: any[]) => {
    if (typeof sql === 'string' && sql.includes('FROM users') && sql.includes('is_active')) {
      // null → account row missing (401), otherwise return the synthetic row
      return Promise.resolve({ rows: authUser ? [authUser] : [] });
    }
    if (otherQueries) return otherQueries(sql, params);
    return Promise.resolve({ rows: [] });
  });
};
