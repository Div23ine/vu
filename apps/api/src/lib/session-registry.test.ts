import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@vunvault/db';
import { createDbSessionLookup } from './session-registry';

/**
 * The row -> record mapping behind every authenticated request.
 *
 * Task 2e added `mfa_setup_deadline` and `mfa_enrolled` to the lookup so the
 * first-login enrolment window can be enforced per request. These tests pin two
 * things that are easy to break silently: that the SELECT actually asks for the
 * new columns, and that a driver `Date` and a driver string both normalise to
 * the same ISO shape (postgres.js returns `Date`, a mocked driver often does
 * not).
 */

function dbReturning(rows: unknown[]): { db: Db; sql: string[] } {
  const sql: string[] = [];
  const client = {
    unsafe: vi.fn(async (query: string) => {
      sql.push(query);
      return rows;
    }),
  };
  return { db: { $client: client } as unknown as Db, sql };
}

const BASE_ROW = {
  session_id: 'sess-1',
  user_id: 'user-1',
  email: 'divine@vunvault.com',
  role: 'super_admin',
  org_id: null,
  revoked_at: null,
  mfa_method: null,
  account_status: 'active',
  deleted_at: null,
};

describe('createDbSessionLookup', () => {
  it('selects the MFA window columns the enforcement depends on', async () => {
    const { db, sql } = dbReturning([]);
    const lookup = createDbSessionLookup(db);

    await lookup('sess-1');

    const query = sql[0] ?? '';
    expect(query).toContain('p.email');
    expect(query).toContain('p.role');
    expect(query).toContain('p.org_id');
    expect(query).toContain('p.mfa_setup_deadline');
    expect(query).toContain('p.mfa_enrolled');
    // The join is what makes the profile columns available at all.
    expect(query).toContain('join profiles p on p.id = s.user_id');
  });

  it('returns null when the session row does not exist', async () => {
    const { db } = dbReturning([]);
    await expect(createDbSessionLookup(db)('missing')).resolves.toBeNull();
  });

  it('normalises a Date deadline to ISO and carries mfaEnrolled through', async () => {
    const deadline = new Date('2026-03-01T12:05:00.000Z');
    const { db } = dbReturning([
      { ...BASE_ROW, mfa_setup_deadline: deadline, mfa_enrolled: false },
    ]);

    const record = await createDbSessionLookup(db)('sess-1');

    expect(record).toMatchObject({
      sessionId: 'sess-1',
      userId: 'user-1',
      email: 'divine@vunvault.com',
      role: 'super_admin',
      orgId: null,
      mfaSetupDeadline: '2026-03-01T12:05:00.000Z',
      mfaEnrolled: false,
      accountStatus: 'active',
    });
  });

  it('normalises a string deadline identically', async () => {
    const { db } = dbReturning([
      {
        ...BASE_ROW,
        mfa_setup_deadline: '2026-03-01T12:05:00.000Z',
        mfa_enrolled: true,
      },
    ]);

    const record = await createDbSessionLookup(db)('sess-1');

    expect(record?.mfaSetupDeadline).toBe('2026-03-01T12:05:00.000Z');
    expect(record?.mfaEnrolled).toBe(true);
  });

  it('keeps a null deadline null — the common case for every enrolled account', async () => {
    const { db } = dbReturning([{ ...BASE_ROW, mfa_setup_deadline: null, mfa_enrolled: true }]);

    const record = await createDbSessionLookup(db)('sess-1');

    expect(record?.mfaSetupDeadline).toBeNull();
    expect(record?.mfaEnrolled).toBe(true);
  });

  it('throws rather than silently skipping enforcement when the client is absent', () => {
    expect(() => createDbSessionLookup({} as Db)).toThrow(/database client is not available/);
  });
});
