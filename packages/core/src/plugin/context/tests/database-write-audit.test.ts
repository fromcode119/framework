import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseContextProxy } from '../database';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '../../../constants/system.constants';

/**
 * Plugin `context.db` is tenant-scoped: an untenanted query THROWS rather than silently returning
 * every tenant's rows. These suites exercise other behaviour, so each test runs inside a tenant the
 * way a real request does. `enterWith` in a beforeEach does NOT work here — vitest runs the hook and
 * the test in separate async contexts, so the store has to wrap the test body itself.
 */
const tenantIt = (name: string, fn: () => unknown) =>
  it(name, () => RequestContextUtils.storage.run({ locale: 'en', tenantId: 't1' }, async () => { await fn(); }));


const security = {
  hasCapability: () => true,
  handleViolation: vi.fn(),
  handleRateLimit: vi.fn(),
} as any;

const buildPlugin = (slug: string) => ({ manifest: { slug, name: slug, version: '1.0.0' } }) as any;

const buildManager = (options: { excludedTables?: string; failAudit?: boolean; failMetaRead?: boolean } = {}) => {
  const manager: any = {
    db: {
      find: vi.fn(async () => []),
      findOne: vi.fn(async (_table: string, where: any) => {
        if (where?.key === SystemConstants.META_KEY.AUDIT_DB_WRITE_EXCLUDED_TABLES) {
          if (options.failMetaRead) throw new Error('meta unavailable');
          return { key: where.key, value: options.excludedTables ?? '' };
        }
        return null;
      }),
      insert: vi.fn(async () => ({ id: 1 })),
      update: vi.fn(async () => ({ id: 1 })),
      delete: vi.fn(async () => true),
      upsert: vi.fn(async () => ({ id: 1 })),
      groupCount: vi.fn(async () => []),
      execute: vi.fn(async () => []),
    },
    audit: {
      logAction: options.failAudit
        ? vi.fn(() => { throw new Error('audit sink down'); })
        : vi.fn(async () => undefined),
    },
    getCollection: () => null,
  };
  return manager;
};

/** The audit write is fire-and-forget (exclusions resolve async); drain the queue before asserting. */
const flushAudit = () => new Promise((resolve) => setTimeout(resolve, 0));

const writeAuditCalls = (manager: any) =>
  manager.audit.logAction.mock.calls.filter((call: unknown[]) => call[1] === 'Database Write');

describe('plugin context.db write audit', () => {

  tenantIt('audits an insert with the physical table as the resource — the standard write path was silent', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await db.insert('fcp_alpha_products', { name: 'secret product name' });
    await flushAudit();

    expect(writeAuditCalls(manager)).toEqual([
      ['alpha', 'Database Write', 'fcp_alpha_products', 'allowed', { method: 'insert' }],
    ]);
  });

  tenantIt('never logs payload values — only table, id and method reach the audit row', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await db.insert('fcp_alpha_customers', { email: 'person@example.com' });
    await db.update('fcp_alpha_customers', { id: 4 }, { email: 'person@example.com' });
    await flushAudit();

    const serialized = JSON.stringify(manager.audit.logAction.mock.calls);
    expect(serialized).not.toContain('person@example.com');
  });

  tenantIt('audits an update as table/id when the where carries a scalar id', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('ecommerce'), manager, security);

    await db.update('fcp_ecommerce_products', { id: 8 }, { price: 12 });
    await flushAudit();

    expect(writeAuditCalls(manager)).toEqual([
      ['ecommerce', 'Database Write', 'fcp_ecommerce_products/8', 'allowed', { method: 'update' }],
    ]);
  });

  tenantIt('audits a delete as table/id', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await db.delete('fcp_alpha_notes', { id: 'abc-3' });
    await flushAudit();

    expect(writeAuditCalls(manager)).toEqual([
      ['alpha', 'Database Write', 'fcp_alpha_notes/abc-3', 'allowed', { method: 'delete' }],
    ]);
  });

  tenantIt('falls back to the table alone when the where has no scalar id', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await db.update('fcp_alpha_notes', { status: 'draft' }, { status: 'published' });
    await flushAudit();

    expect(writeAuditCalls(manager)).toEqual([
      ['alpha', 'Database Write', 'fcp_alpha_notes', 'allowed', { method: 'update' }],
    ]);
  });

  tenantIt('resolves a semantic table reference to its physical name in the resource', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await db.insert('@alpha/events', { type: 'view' });
    await flushAudit();

    expect(writeAuditCalls(manager)).toEqual([
      ['alpha', 'Database Write', 'fcp_alpha_events', 'allowed', { method: 'insert' }],
    ]);
  });

  tenantIt('resolves a bare table name against the plugin prefix in the resource', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await db.insert('products', { name: 'x' });
    await flushAudit();

    expect(writeAuditCalls(manager)).toEqual([
      ['alpha', 'Database Write', 'fcp_alpha_products', 'allowed', { method: 'insert' }],
    ]);
  });

  tenantIt('skips tables the operator listed in the excluded-tables setting, and only those', async () => {
    const manager = buildManager({ excludedTables: 'fcp_alpha_events, fcp_alpha_sessions' });
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await db.insert('fcp_alpha_events', { type: 'view' });
    await db.insert('@alpha/sessions', { visitor: 'v1' });
    await db.insert('fcp_alpha_products', { name: 'x' });
    await flushAudit();

    expect(writeAuditCalls(manager)).toEqual([
      ['alpha', 'Database Write', 'fcp_alpha_products', 'allowed', { method: 'insert' }],
    ]);
  });

  tenantIt('audits everything when the excluded-tables setting cannot be read — no invented exclusions', async () => {
    const manager = buildManager({ failMetaRead: true });
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await db.insert('fcp_alpha_events', { type: 'view' });
    await flushAudit();

    expect(writeAuditCalls(manager)).toHaveLength(1);
  });

  tenantIt('does not audit reads', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await db.find('fcp_alpha_products', { where: { status: 'active' } });
    await db.findOne('fcp_alpha_products', { id: 1 });
    await flushAudit();

    expect(writeAuditCalls(manager)).toHaveLength(0);
  });

  tenantIt('audits execute per call as a write, without recording the SQL text', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await db.execute('UPDATE fcp_alpha_products SET secret = 1');
    await flushAudit();

    expect(writeAuditCalls(manager)).toEqual([
      ['alpha', 'Database Write', 'execute', 'allowed', { method: 'execute' }],
    ]);
    expect(JSON.stringify(manager.audit.logAction.mock.calls)).not.toContain('SET secret');
  });

  tenantIt('does not expose arbitrary raw manager methods', async () => {
    const manager = buildManager();
    manager.db.queryRaw = vi.fn();
    manager.db.resetDatabase = vi.fn();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    expect(() => db.queryRaw).toThrow(/cannot access context\.db\.queryRaw/);
    expect(() => db.resetDatabase).toThrow(/cannot access context\.db\.resetDatabase/);
    expect(manager.db.queryRaw).not.toHaveBeenCalled();
    expect(manager.db.resetDatabase).not.toHaveBeenCalled();
  });

  tenantIt('does not let a read-only capability call a write method', async () => {
    const manager = buildManager();
    const readOnlySecurity = {
      hasCapability: (capability: string) => capability === 'database:read',
      handleViolation: (capability: string) => { throw new Error(`missing ${capability}`); },
      handleRateLimit: vi.fn(),
    } as any;
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, readOnlySecurity);

    await expect(async () => db.insert('fcp_alpha_products', { name: 'x' }))
      .rejects.toThrow(/database:write/);
    expect(manager.db.insert).not.toHaveBeenCalled();
  });

  tenantIt('is per CALL, not per property access — accessing the method audits nothing, two calls audit two rows', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    const insert = db.insert; // property access alone — the old get-trap counted this as a write
    await flushAudit();
    expect(writeAuditCalls(manager)).toHaveLength(0);

    await insert('fcp_alpha_products', { name: 'a' });
    await insert('fcp_alpha_products', { name: 'b' });
    await flushAudit();
    expect(writeAuditCalls(manager)).toHaveLength(2);
  });

  tenantIt('a failing audit sink never breaks or rejects the write itself', async () => {
    const manager = buildManager({ failAudit: true });
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    const row = await db.insert('fcp_alpha_products', { name: 'x' });
    await flushAudit();

    expect(row).toEqual({ id: 1 });
    expect(manager.db.insert).toHaveBeenCalledTimes(1);
  });

  tenantIt('a denied write on a protected table is not also logged as an allowed Database Write', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await expect(async () => db.insert('fcp_beta_orders', { name: 'x' })).rejects.toThrow(/Security Violation/);
    await flushAudit();

    expect(writeAuditCalls(manager)).toHaveLength(0);
  });

  tenantIt('audits an upsert as a write with the table as the resource — its second arg is the payload, never mined for an id', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await db.upsert('fcp_alpha_customers', { id: 9, email: 'person@example.com' }, { target: 'id', set: { email: 'person@example.com' } });
    await flushAudit();

    expect(writeAuditCalls(manager)).toEqual([
      ['alpha', 'Database Write', 'fcp_alpha_customers', 'allowed', { method: 'upsert' }],
    ]);
    expect(JSON.stringify(manager.audit.logAction.mock.calls)).not.toContain('person@example.com');
  });

  tenantIt('a denied upsert on a system table throws and is not logged as an allowed write', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await expect(async () => db.upsert('users', { id: 1 }, { target: 'id', set: {} })).rejects.toThrow(/Security Violation/);
    await expect(async () => db.upsert('fcp_beta_orders', { id: 1 }, { target: 'id', set: {} })).rejects.toThrow(/Security Violation/);
    await flushAudit();

    expect(writeAuditCalls(manager)).toHaveLength(0);
    expect(manager.db.upsert).not.toHaveBeenCalled();
  });

  tenantIt('groupCount is a guarded read — another plugin\'s table throws, own table is not audited as a write', async () => {
    const manager = buildManager();
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('alpha'), manager, security);

    await expect(async () => db.groupCount('_system_audit_log', { groupBy: ['action'] })).rejects.toThrow(/Security Violation/);
    expect(manager.db.groupCount).not.toHaveBeenCalled();

    await db.groupCount('fcp_alpha_events', { groupBy: ['type'] });
    await flushAudit();

    expect(manager.db.groupCount).toHaveBeenCalledTimes(1);
    expect(writeAuditCalls(manager)).toHaveLength(0);
  });

  tenantIt('upsert and groupCount consume the database rate limit — they were exempt while missing from the method list', async () => {
    const manager = buildManager();
    const rateSecurity = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('rate-limit-upsert-probe'), manager, rateSecurity);

    for (let i = 0; i < 2501; i += 1) { void db.upsert; void db.groupCount; }
    expect(rateSecurity.handleRateLimit).toHaveBeenCalledWith('database');
  });

  tenantIt('insert consumes the database rate limit — it was exempt while missing from the method list', async () => {
    const manager = buildManager();
    const rateSecurity = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;
    const db: any = DatabaseContextProxy.createDatabaseProxy(buildPlugin('rate-limit-insert-probe'), manager, rateSecurity);

    for (let i = 0; i < 5001; i += 1) void db.insert;
    expect(rateSecurity.handleRateLimit).toHaveBeenCalledWith('database');
  });
});
