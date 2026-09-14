import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PersonalDataErasureService } from '@core/plugin/services/people/personal-data-erasure-service';
import { RequestContextUtils } from '@core/context/request-context';

const SUBJECT = { email: 'subject@example.invalid', userId: 7, personId: 3 };

const makeDb = (tables: Record<string, any[]>) => {
  const db: any = {
    tables,
    platformScopes: 0,
    withPlatformAdmin: vi.fn(async (fn: () => Promise<unknown>) => { db.platformScopes += 1; return fn(); }),
    findOne: vi.fn(async (table: string, where: any) => (tables[table] ?? []).find((row) =>
      Object.entries(where).every(([k, v]) => String(row[k]) === String(v))) ?? null),
    find: vi.fn(async (table: string, opts: any) => {
      const where = opts?.where ?? {};
      return (tables[table] ?? []).filter((row) => Object.entries(where).every(([k, v]) => String(row[k]) === String(v)));
    }),
    update: vi.fn(async (table: string, where: any, patch: any) => {
      for (const row of tables[table] ?? []) {
        if (Object.entries(where).every(([k, v]) => String(row[k]) === String(v))) Object.assign(row, patch);
      }
    }),
    delete: vi.fn(async (table: string, where: any) => {
      tables[table] = (tables[table] ?? []).filter((row) =>
        !Object.entries(where).every(([k, v]) => String(row[k]) === String(v)));
    }),
  };
  return db;
};

/**
 * `users` has NO tenant_id and RLS is off on it — one account can administer several sites. A
 * site-level erasure must never take a login away from sites that did not receive the request and
 * whose operators are separate controllers.
 */
describe('PersonalDataErasureService — the global account', () => {
  beforeEach(() => vi.restoreAllMocks());

  const withTenant = (tenantId: string | undefined) =>
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(tenantId as any);

  it('KEEPS a shared account and says how many other sites hold it', async () => {
    withTenant('acme');
    const db = makeDb({
      users: [{ id: 7, email: SUBJECT.email, username: SUBJECT.email }],
      _system_tenant_memberships: [
        { id: 1, user_id: '7', tenant_id: 'acme' },
        { id: 2, user_id: '7', tenant_id: 'globex' },
      ],
    });

    const result = await new PersonalDataErasureService(db).eraseDataset('account', SUBJECT, 'anonymise');

    expect(result).toMatchObject({ retained: 1, anonymised: 0, erased: 0, remaining: 0 });
    expect(result.retainedReason).toContain('1 other site');
    expect(db.tables.users[0].email).toBe(SUBJECT.email);
  });

  it('tombstones the account when this was the last site holding it', async () => {
    withTenant('acme');
    const db = makeDb({
      users: [{ id: 7, email: SUBJECT.email, username: SUBJECT.email, firstName: 'A', lastName: 'B' }],
      _system_tenant_memberships: [{ id: 1, user_id: '7', tenant_id: 'acme' }],
    });

    const result = await new PersonalDataErasureService(db).eraseDataset('account', SUBJECT, 'anonymise');

    expect(result).toMatchObject({ anonymised: 1, retained: 0, remaining: 0 });
    expect(db.tables.users[0].email).toContain('@deleted.invalid');
    expect(db.tables.users[0].firstName).toBeNull();
  });

  it('removes only THIS site\'s membership', async () => {
    withTenant('acme');
    const db = makeDb({
      _system_tenant_memberships: [
        { id: 1, user_id: '7', tenant_id: 'acme' },
        { id: 2, user_id: '7', tenant_id: 'globex' },
      ],
      _system_users_roles: [],
    });

    const result = await new PersonalDataErasureService(db).eraseDataset('roles', SUBJECT, 'delete');

    expect(result.erased).toBe(1);
    expect(db.tables._system_tenant_memberships.map((r: any) => r.tenant_id)).toEqual(['globex']);
  });
});

describe('PersonalDataErasureService — the journals', () => {
  const auditRows = () => ([
    { id: 1, action: 'collection.delete', resource: 'orders', status: 'allowed', metadata: { userId: 7, email: SUBJECT.email } },
    { id: 2, action: 'settings.update', resource: 'system', status: 'allowed', metadata: { userId: 99, email: 'other@example.invalid' } },
  ]);

  it('keeps what happened and destroys who did it', async () => {
    const db = makeDb({ _system_audit_logs: auditRows() });
    db.find = vi.fn(async (table: string) => db.tables[table] ?? []);

    const result = await new PersonalDataErasureService(db).eraseDataset('audit-log', SUBJECT, 'anonymise');

    expect(result).toMatchObject({ anonymised: 1, erased: 0, remaining: 0 });
    const mine = db.tables._system_audit_logs[0];
    expect(mine.action).toBe('collection.delete');
    expect(mine.resource).toBe('orders');
    expect(mine.status).toBe('allowed');
    expect(mine.metadata.email).toBe(PersonalDataErasureService.TOMBSTONE);
    expect(mine.metadata.userId).toBe(PersonalDataErasureService.TOMBSTONE);
    // Somebody else's row is untouched.
    expect(db.tables._system_audit_logs[1].metadata.email).toBe('other@example.invalid');
  });

  /** The journal policy narrows an unmarked write to `tenant_id IS NULL` rows, silently. */
  it('touches the journal INSIDE a platform-admin scope', async () => {
    const db = makeDb({ _system_audit_logs: auditRows() });
    db.find = vi.fn(async (table: string) => db.tables[table] ?? []);

    await new PersonalDataErasureService(db).eraseDataset('audit-log', SUBJECT, 'anonymise');

    expect(db.platformScopes).toBe(1);
  });

  it('offers no delete for the audit trail — it is the security record', () => {
    const audit = new PersonalDataErasureService(makeDb({})).listDatasets().find((d) => d.key === 'audit-log');
    expect(audit?.strategies).not.toContain('delete');
  });

  it('retain touches nothing at all', async () => {
    const db = makeDb({ _system_audit_logs: auditRows() });

    const result = await new PersonalDataErasureService(db).eraseDataset('audit-log', SUBJECT, 'retain');

    expect(result).toMatchObject({ erased: 0, anonymised: 0, remaining: 0 });
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe('PersonalDataErasureService — declarations', () => {
  it('never declares a default it does not also offer', () => {
    for (const dataset of new PersonalDataErasureService(makeDb({})).listDatasets()) {
      expect(dataset.strategies).toContain(dataset.defaultStrategy);
    }
  });
});
