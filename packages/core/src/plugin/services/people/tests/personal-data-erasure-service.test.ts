import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PersonalDataErasureService } from '@core/plugin/services/people/personal-data-erasure-service';
import { PersonalDataRegistry } from '@core/plugin/services/people/personal-data-registry';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';

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

  /**
   * WHICH scope the journal is touched in, and why it is not always the platform marker.
   *
   * The `_system_logs` policy is asymmetric: `USING` admits `app.platform_admin = 'on'`, but its
   * `WITH CHECK` has no platform clause at all. So under the marker a scrub SELECTS every tenant's
   * rows and then cannot write back any row owned by a site — the update was refused and the whole
   * erasure died with "new row violates row-level security policy". Every self-delete by anyone who
   * had ever signed in failed that way, and no site's journal was ever actually anonymised.
   */
  it('scrubs the journal in the SITE\'s own scope when there is a site', async () => {
    const db = makeDb({ _system_audit_logs: auditRows() });
    db.find = vi.fn(async (table: string) => db.tables[table] ?? []);
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue('fromcode');

    await new PersonalDataErasureService(db).eraseDataset('audit-log', SUBJECT, 'anonymise');

    // No platform marker: the site's own scope both finds and may write its rows — and it is the
    // right scope anyway, since a DSAR is made to one controller about one site.
    expect(db.platformScopes).toBe(0);
    expect(db.tables._system_audit_logs[0].metadata.email).toBe(PersonalDataErasureService.TOMBSTONE);
  });

  it('falls back to the platform marker when there is no site to scope to', async () => {
    // Untenanted there is no site, and the marker is what reaches the PLATFORM's own rows
    // (`tenant_id IS NULL`) — which that same WITH CHECK does allow.
    const db = makeDb({ _system_audit_logs: auditRows() });
    db.find = vi.fn(async (table: string) => db.tables[table] ?? []);
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(undefined as any);

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
    // Addressed `platform:<key>`, the same id a plugin's dataset uses and the same id the operator's
    // stored policy is keyed against — one id shape everywhere a dataset is stored, shown or overridden.
    const declared = subject.listDatasets().map((dataset) => `platform:${dataset.key}`).sort();

    const results = await subject.eraseAll(SUBJECT as any);

    expect(Object.keys(results).sort()).toEqual(declared);
  });

  it('reports WHO decided each strategy, not only what was applied', async () => {
    // "retained 32 invoices" is only actionable beside who decided to retain them. With nothing
    // stored at either layer, every dataset must say it fell through to the declaring plugin.
    const results = await service().eraseAll(SUBJECT as any);

    const account = results['platform:account'];
    expect(account.source).toBe('declared');
    expect(account.provenance).toBe('Default declared by platform');
    expect(account.strategy).toBe('anonymise');
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

  it('honours the SITE policy through the same call `deleteMyAccount` makes', async () => {
    // The whole point of moving the policy into core. `deleteMyAccount` passes no strategy and no
    // override; if the site's stored choice did not reach the erasure from here, a self-delete would
    // anonymise a journal the operator marked `retain` — which is what happened while the policy was
    // a plugin setting core could not read.
    const db = makeDb({
      [SystemConstants.TABLE.META]: [{
        key: SystemConstants.META_KEY.PERSONAL_DATA_ERASURE_STRATEGIES,
        value: JSON.stringify({ 'platform:audit-log': { strategy: 'retain', reason: 'Security record, 2 years.' } }),
      }],
    });
    const subject = new PersonalDataErasureService(db as any);

    const results = await subject.eraseAll(SUBJECT as any);

    expect(results['platform:audit-log']).toMatchObject({
      strategy: 'retain', source: 'site', reason: 'Security record, 2 years.',
    });
    // Everything the operator said nothing about still runs on its own declared default.
    expect(results['platform:sessions'].source).toBe('declared');
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

/**
 * The registry is FRAMEWORK-owned, so an erasure reaches a plugin's data on every site — including
 * one with no privacy plugin installed. Before this, `deleteMyAccount` walked the seven datasets the
 * framework holds itself and left every order, invoice and submission in place, reporting nothing.
 */
describe('PersonalDataErasureService.eraseAll — plugin datasets, with or without a privacy plugin', () => {
  beforeEach(() => { vi.restoreAllMocks(); PersonalDataRegistry.clear(); });

  const registerSource = (calls: Array<{ key: string; strategy: string }>) =>
    PersonalDataRegistry.register(
      { namespace: 'org.fromcode', pluginSlug: 'finance', key: 'invoices', label: 'Invoices',
        fields: ['customerEmail'], strategies: ['retain', 'anonymise'], defaultStrategy: 'retain',
        methods: { export: 'exportPersonalData', erase: 'erasePersonalData' } },
      {
        exportSubject: async () => [],
        eraseSubject: async (_s: unknown, strategy: string) => {
          calls.push({ key: 'invoices', strategy });
          return { strategy, erased: 0, anonymised: 0, retained: 3, remaining: 0 };
        },
      },
    );

  it('reaches a registered plugin dataset and uses its declared default', async () => {
    const calls: Array<{ key: string; strategy: string }> = [];
    registerSource(calls);
    const service = new PersonalDataErasureService(makeDb({}) as any);

    const results = await service.eraseAll(SUBJECT as any);

    expect(calls).toEqual([{ key: 'invoices', strategy: 'retain' }]);
    expect(results['finance:invoices'].retained).toBe(3);
  });

  it('lets a caller choose a strategy, but only one the dataset declared', async () => {
    const calls: Array<{ key: string; strategy: string }> = [];
    registerSource(calls);
    const service = new PersonalDataErasureService(makeDb({}) as any);

    // `delete` is NOT in this dataset's declared set — an invoice is a statutory document. A caller
    // asking for it gets the declared default, never a strategy the plugin refused to support.
    await service.eraseAll(SUBJECT as any, () => 'delete');

    expect(calls).toEqual([{ key: 'invoices', strategy: 'retain' }]);
  });

  it('records a source that threw instead of letting it look like an empty result', async () => {
    PersonalDataRegistry.register(
      { namespace: 'org.fromcode', pluginSlug: 'ecommerce', key: 'orders', label: 'Orders',
        fields: ['email'], strategies: ['anonymise'], defaultStrategy: 'anonymise',
        methods: { export: 'e', erase: 'r' } },
      { exportSubject: async () => [], eraseSubject: async () => { throw new Error('table locked'); } },
    );
    const service = new PersonalDataErasureService(makeDb({}) as any);

    const results = await service.eraseAll(SUBJECT as any);

    expect(String((results['ecommerce:orders'] as any).error)).toContain('table locked');
  });
});

/**
 * The export door, held to the same property as the erasure door.
 *
 * `exportMyData` assembled an account and a person record by hand — two objects — while the same
 * subject asking through a DSAR received every framework dataset plus every plugin's. Someone
 * exercising Art. 15 from their own account page was told the platform held almost nothing.
 */
describe('PersonalDataErasureService.exportAll — the export door cannot drift either', () => {
  beforeEach(() => { vi.restoreAllMocks(); PersonalDataRegistry.clear(); });

  const service = () => new PersonalDataErasureService(makeDb({
    users: [{ id: 7, email: SUBJECT.email }],
    people: [{ id: 3, email: SUBJECT.email }],
  }) as any);

  it('covers every framework dataset, not a hand-picked pair', async () => {
    const datasets = await service().exportAll(SUBJECT as any);

    const platform = datasets.filter((d: any) => d.plugin === 'platform').map((d: any) => d.dataset);
    expect(platform).toEqual([
      'account', 'person', 'sessions', 'roles', 'record-versions', 'audit-log', 'system-log',
    ]);
  });

  it('includes every registered plugin dataset', async () => {
    PersonalDataRegistry.register(
      { namespace: 'org.fromcode', pluginSlug: 'finance', key: 'invoices', label: 'Invoices',
        fields: ['customerEmail'], strategies: ['retain'], defaultStrategy: 'retain',
        methods: { export: 'exportPersonalData', erase: 'erasePersonalData' } },
      { exportSubject: async () => [{ id: 1 }, { id: 2 }], eraseSubject: async () => ({}) },
    );

    const datasets = await service().exportAll(SUBJECT as any);
    const invoices: any = datasets.find((d: any) => d.plugin === 'finance' && d.dataset === 'invoices');

    expect(invoices.records).toHaveLength(2);
    expect(invoices.personalDataFields).toEqual(['customerEmail']);
  });

  it('reports a source that failed rather than omitting it', async () => {
    // A silently short export reads to the subject as "you hold nothing about me" — the one thing an
    // export must never imply.
    PersonalDataRegistry.register(
      { namespace: 'org.fromcode', pluginSlug: 'ecommerce', key: 'orders', label: 'Orders',
        fields: ['email'], strategies: ['anonymise'], defaultStrategy: 'anonymise',
        methods: { export: 'e', erase: 'r' } },
      { exportSubject: async () => { throw new Error('table locked'); }, eraseSubject: async () => ({}) },
    );

    const datasets = await service().exportAll(SUBJECT as any);
    const orders: any = datasets.find((d: any) => d.dataset === 'orders');

    expect(orders.records).toBeUndefined();
    expect(String(orders.error)).toContain('table locked');
  });
});

/**
 * A retained dataset reports ZERO of everything — `retain` keeps the rows, it does not count them.
 *
 * `deleteMyAccount` reads this to decide what the subject is told, and reading `retained` alone told
 * someone whose operator had chosen retention that their account had been deleted. The strategy is
 * the fact; the counts are not.
 */
describe('a retained dataset is distinguishable from an erased one', () => {
  beforeEach(() => { vi.restoreAllMocks(); PersonalDataRegistry.clear(); });

  it('reports the retain strategy even though every count is zero', async () => {
    const db = makeDb({
      users: [{ id: 7, email: SUBJECT.email }],
      [SystemConstants.TABLE.META]: [{
        key: SystemConstants.META_KEY.PERSONAL_DATA_ERASURE_STRATEGIES,
        value: JSON.stringify({ 'platform:account': { strategy: 'retain', reason: 'Statutory hold.' } }),
      }],
    });

    const results = await new PersonalDataErasureService(db as any).eraseAll(SUBJECT as any);
    const account = results[PersonalDataErasureService.ACCOUNT_ID];

    expect(account.strategy).toBe(PersonalDataErasureService.RETAIN_STRATEGY);
    expect(account.retained).toBe(0);
    expect(account.reason).toBe('Statutory hold.');
    // The account row must still be there — retain means kept.
    expect(db.tables.users).toHaveLength(1);
    expect(db.tables.users[0].email).toBe(SUBJECT.email);
  });
});

/**
 * The journal COUNT must describe the same rows the scrub will touch.
 *
 * Under the platform marker it spanned every site — admitted for reading, which is why it never
 * failed the way the write did — so a request about one site reported that person's journal rows
 * across the deployment, and the figure could never reach zero however often the erasure ran.
 */
describe('the journal count is scoped like the scrub', () => {
  beforeEach(() => { vi.restoreAllMocks(); PersonalDataRegistry.clear(); });

  const auditRows = () => ([
    { id: 1, action: 'collection.delete', resource: 'orders', status: 'allowed', metadata: { userId: 7, email: SUBJECT.email } },
    { id: 2, action: 'settings.update', resource: 'system', status: 'allowed', metadata: { userId: 99, email: 'other@example.invalid' } },
  ]);

  it('counts in the site\'s own scope when there is a site', async () => {
    const db = makeDb({ _system_audit_logs: auditRows() });
    db.find = vi.fn(async (table: string) => db.tables[table] ?? []);
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue('fromcode');

    await new PersonalDataErasureService(db).exportDataset('audit-log', SUBJECT);

    expect(db.platformScopes).toBe(0);
  });

  it('uses the platform marker only when there is no site', async () => {
    const db = makeDb({ _system_audit_logs: auditRows() });
    db.find = vi.fn(async (table: string) => db.tables[table] ?? []);
    vi.spyOn(RequestContextUtils, 'getTenantId').mockReturnValue(undefined as any);

    await new PersonalDataErasureService(db).exportDataset('audit-log', SUBJECT);

    expect(db.platformScopes).toBe(1);
  });
});
