import { describe, expect, it, vi } from 'vitest';
import { SchemaManager } from '@core/database/schema-manager';

/**
 * WHICH TABLES MAY BE JUDGED AT ALL.
 *
 * A framework table's columns come from MIGRATIONS, so its collection field list was never the full
 * declaration and a diff against it is meaningless. Two live columns proved it by being proposed for
 * removal: `media.shared`, which the media sharing POLICY itself reads, and `users.is_platform_admin`,
 * which decides who is a platform administrator.
 */
describe('SchemaManager.recordUndeclaredColumns — what may be audited', () => {
  const dbStub = () => ({
    tableExists: async () => true,
    getColumns: async () => ['id', 'shared', 'optimized_path'],
    supportsTenantIsolation: () => true,
  } as any);

  it('never audits a framework collection, however many columns it has', async () => {
    const manager = new SchemaManager(dbStub());
    const recorded: string[] = [];
    (manager as any).reconciliation = {
      record: async (plan: any) => { recorded.push(plan.tableName); },
      prune: async () => undefined,
    };

    await manager.recordUndeclaredColumns([
      { collection: { slug: 'media', fields: [] } as any, pluginSlug: 'system' },
      { collection: { slug: 'record-versions', fields: [], system: true } as any, pluginSlug: 'content' },
    ]);

    expect(recorded).toEqual([]);
  });

  it('protects only a FAILED audit from pruning, so nothing can be stranded', async () => {
    const manager = new SchemaManager(dbStub());
    let failedTables = new Set<string>();
    (manager as any).reconciliation = {
      record: async () => undefined,
      prune: async (failed: Set<string>) => { failedTables = failed; },
    };

    await manager.recordUndeclaredColumns([
      { collection: { slug: 'media', fields: [] } as any, pluginSlug: 'system' },
    ]);

    // A framework collection is excluded from judgement and NOT protected, so anything a past build
    // recorded against it is cleaned up rather than left where it can be approved.
    expect(failedTables.has('media')).toBe(false);
  });

  it('writes the schema fingerprint as the PLATFORM row, whatever tenant is bound', async () => {
    // `syncCollection` also runs inside a request — enabling a plugin with a site selected — and an
    // unwrapped write lands the tenant's row because `_system_meta.tenant_id` defaults to the
    // current tenant. Measured on the dev database: 235 per-tenant duplicates of facts that
    // describe one shared schema, after which the platform row stops being updated and every boot
    // re-syncs tables it already synced.
    let wrapped = false;
    let insertedWhileWrapped = false;
    const db = {
      tableExists: async () => true,
      getColumns: async () => ['id'],
      supportsTenantIsolation: () => true,
      withPlatformAdmin: async (fn: () => Promise<unknown>) => {
        wrapped = true;
        try { return await fn(); } finally { wrapped = false; }
      },
      findOne: async () => null,
      insert: async () => { insertedWhileWrapped = wrapped; return {}; },
      update: async () => ({}),
      createTable: async () => undefined,
      tenantIsolation: { addTenantColumn: async () => undefined, enforceIsolation: async () => undefined, scopeUniqueRules: async () => ({ constraints: [], indexes: [] }), countUnassigned: async () => 0 },
      ensureDeclaredUnique: async () => ({ state: 'satisfied', reason: '' }),
      ensureDeclaredNullable: async () => ({ state: 'satisfied', reason: '' }),
      ensureTimestampDefault: async () => ({ state: 'satisfied', reason: '' }),
      ensurePointInTimeColumn: async () => ({ state: 'satisfied', reason: '' }),
    } as any;

    await new SchemaManager(db).syncCollection({ slug: 'fcp_orbit_pages', fields: [] } as any);

    expect(insertedWhileWrapped).toBe(true);
  });
});
