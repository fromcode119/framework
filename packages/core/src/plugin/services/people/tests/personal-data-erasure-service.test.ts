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

/**
 * There are two doors into erasure — a DSAR, which walks the registry and reaches every dataset, and
 * `deleteMyAccount`, which used to hand-list four of the seven. That gap was silent and real: a
 * person who deleted their own account kept their email and IP in the audit and system logs, while
 * the same person asking through a DSAR had them anonymised.
 *
 * `eraseAll` is what closes it, so these tests hold it to the one property that matters — it covers
 * whatever `listDatasets()` declares, not a list written down twice.
 */
describe('PersonalDataErasureService.eraseAll — the two doors cannot drift', () => {
  beforeEach(() => vi.restoreAllMocks());

  const service = () => new PersonalDataErasureService(makeDb({}) as any);

  it('erases EVERY dataset the service declares, leaving none behind', async () => {
    const subject = service();
    const declared = subject.listDatasets().map((dataset) => dataset.key).sort();

    const results = await subject.eraseAll(SUBJECT as any);

    expect(Object.keys(results).sort()).toEqual(declared);
  });

  it('uses each dataset\'s own declared default strategy, never one strategy for all', async () => {
    const subject = service();
    const seen: Array<{ key: string; strategy: string }> = [];
    const realEraseDataset = subject.eraseDataset.bind(subject);
    subject.eraseDataset = (async (key: string, s: any, strategy: string) => {
      seen.push({ key, strategy });
      return realEraseDataset(key, s, strategy);
    }) as any;

    await subject.eraseAll(SUBJECT as any);

    for (const dataset of subject.listDatasets()) {
      expect(seen.find((call) => call.key === dataset.key)?.strategy, dataset.key).toBe(dataset.defaultStrategy);
    }
    // audit-log must be anonymised and never deleted — it is the security record.
    expect(seen.find((call) => call.key === 'audit-log')?.strategy).toBe('anonymise');
  });

  it('reads the account before the memberships it depends on are removed', async () => {
    const subject = service();
    const order: string[] = [];
    const realEraseDataset = subject.eraseDataset.bind(subject);
    subject.eraseDataset = (async (key: string, s: any, strategy: string) => {
      order.push(key);
      return realEraseDataset(key, s, strategy);
    }) as any;

    await subject.eraseAll(SUBJECT as any);

    // `account` decides whether the login is shared with other sites by reading the memberships that
    // `roles` deletes. Reversed, every account looks unshared and logins vanish from sites that never
    // received the request.
    expect(order.indexOf('account')).toBeLessThan(order.indexOf('roles'));
  });
});

/**
 * A subject routinely has MORE THAN ONE person row: the one linked to their account, plus unlinked
 * rows a plugin's `people.syncDirectory` created from its own table — an invoice customer lands as
 * `source: finance` with no `user_id`.
 *
 * `findPerson` used `findOne`, so an erasure removed whichever row the database returned first and
 * left the rest. Which one survived was chance, and the leftover still carried the subject's email
 * after a request reported as fulfilled. No retention obligation defends that: the statutory
 * document is the invoice, not a directory row derived from it.
 */
describe('PersonalDataErasureService — every person row, not the first one found', () => {
  beforeEach(() => vi.restoreAllMocks());

  const twoPeople = () => ({
    people: [
      { id: 1, user_id: 42, email: 'subject@example.invalid', source: 'account' },
      { id: 2, user_id: null, email: 'subject@example.invalid', source: 'finance' },
    ],
    people_addresses: [{ id: 9, person_id: 2 }],
    person_relationships: [],
  });

  it('deletes BOTH rows, including the unlinked one a directory sync created', async () => {
    const tables = twoPeople();
    const service = new PersonalDataErasureService(makeDb(tables) as any);

    const result = await service.eraseDataset('person', { email: 'subject@example.invalid' } as any, 'delete');

    expect(tables.people).toEqual([]);
    // 2 people + 1 address belonging to the row that would previously have been missed.
    expect(result.erased).toBe(3);
  });

  it('anonymises BOTH rows rather than leaving one readable', async () => {
    const tables = twoPeople();
    const service = new PersonalDataErasureService(makeDb(tables) as any);

    const result = await service.eraseDataset('person', { email: 'subject@example.invalid' } as any, 'anonymise');

    expect(result.anonymised).toBe(2);
    expect(tables.people.map((row: any) => row.email)).toEqual([null, null]);
  });

  /**
   * This test asserted the OPPOSITE first, and the opposite was the bug.
   *
   * Resolving a DSAR subject sets `personId` from `people.getByEmail`, which returns one row — so
   * "honour the explicit personId" meant "erase one row and keep the duplicates", which is how the
   * live erasure still left `dsar-probe6` in `people` after the first fix. The email leads; a
   * personId only ADDS a row the email did not reach.
   */
  it('erases every row for the email even when a personId is also given', async () => {
    const tables = twoPeople();
    const service = new PersonalDataErasureService(makeDb(tables) as any);

    await service.eraseDataset('person', { email: 'subject@example.invalid', personId: 2 } as any, 'delete');

    expect(tables.people).toEqual([]);
  });

  it('erases the named person when there is no email to lead with', async () => {
    const tables = twoPeople();
    const service = new PersonalDataErasureService(makeDb(tables) as any);

    await service.eraseDataset('person', { personId: 2 } as any, 'delete');

    expect(tables.people.map((row: any) => row.id)).toEqual([1]);
  });
});
