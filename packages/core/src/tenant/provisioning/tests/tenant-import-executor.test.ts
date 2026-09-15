import { describe, expect, it, vi } from 'vitest';
import type { IDatabaseManager } from '@fromcode119/database';
import { TenantArchiveManifest } from '@core/tenant/provisioning/tenant-archive-manifest';
import type { TenantArchiveReader } from '@core/tenant/provisioning/tenant-archive-reader';
import { TenantColumnReference } from '@core/tenant/provisioning/tenant-column-reference';
import { TenantIdentity } from '@core/tenant/provisioning/tenant-identity';
import { TenantImportExecutor } from '@core/tenant/provisioning/tenant-import-executor';
import { TenantImportPlan } from '@core/tenant/provisioning/tenant-import-plan';
import type { TenantRegistryService } from '@core/tenant/provisioning/tenant-registry-service';
import { TenantTableCatalog } from '@core/tenant/provisioning/tenant-table-catalog';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

/**
 * Two fictional tables that reference EACH OTHER — the shape that exposed the bug: ids used to be
 * decided and allocated per table, immediately before that table's own inserts, in dependency order.
 * A cycle's tie-break ("whichever came first goes first") inserts one of the two tables before the
 * other even gets its ids allocated, so its reference to the not-yet-processed table resolved to the
 * SOURCE id — stale the moment the other table's rows land on new ones. Allocating every table's ids
 * before any row of any table is inserted (this test's subject) fixes that regardless of order.
 */
describe('TenantImportExecutor — ids are allocated for every table before any row is inserted', () => {
  it('re-points a reference to a table this dependency order inserts AFTER it', async () => {
    const refAtoB = new TenantColumnReference('fcp_widgets_a', 'link', 'fcp_widgets_b', 'schema');
    const refBtoA = new TenantColumnReference('fcp_widgets_b', 'link', 'fcp_widgets_a', 'schema');
    const a = new TenantTableDescriptor('fcp_widgets_a', { id: 'integer', tenant_id: 'text', link: 'integer' }, true, 'fcp_widgets_a_id_seq', [refAtoB]);
    const b = new TenantTableDescriptor('fcp_widgets_b', { id: 'integer', tenant_id: 'text', link: 'integer' }, true, 'fcp_widgets_b_id_seq', [refBtoA]);
    const tables = TenantTableCatalog.inDependencyOrder([a, b]);
    // Confirms the premise this test relies on: "b" is inserted first, so if ids were still allocated
    // per table (the old behaviour) "a" would not have its new ids yet when "b.link" is re-pointed.
    expect(tables.map((t) => t.name)).toEqual(['fcp_widgets_b', 'fcp_widgets_a']);

    const rowsByTable: Record<string, Array<Record<string, unknown>>> = {
      fcp_widgets_a: [{ id: 1, link: null }],
      fcp_widgets_b: [{ id: 1, link: 1 }], // points at fcp_widgets_a's archived id 1
    };
    const insertedRows: Record<string, Array<Record<string, unknown>>> = { fcp_widgets_a: [], fcp_widgets_b: [] };
    const bases: Record<string, number> = { fcp_widgets_a_id_seq: 1000, fcp_widgets_b_id_seq: 2000 };

    const db = {
      withTenant: vi.fn(async (_tenantId: string, fn: () => Promise<void>) => fn()),
      queryRaw: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return [];
        const seqMatch = /"(fcp_widgets_[ab]_id_seq)"/.exec(sql);
        if (seqMatch && sql.includes('is_called')) return [{ last_value: bases[seqMatch[1]], is_called: true }];
        if (seqMatch && sql.includes('nextval') && sql.includes('generate_series')) {
          const base = bases[seqMatch[1]];
          const count = Number(params[0]);
          return Array.from({ length: count }, (_, index) => ({ id: base + 1 + index }));
        }
        if (sql.startsWith('INSERT INTO')) {
          const insertMatch = /INSERT INTO "([^"]+)" \(([^)]+)\)/.exec(sql);
          if (insertMatch) {
            const table = insertMatch[1];
            const columns = insertMatch[2].split(',').map((c) => c.trim().replace(/"/g, ''));
            (insertedRows[table] ??= []).push(Object.fromEntries(columns.map((column, index) => [column, params[index]])));
          }
          return [];
        }
        return [];
      }),
    } as unknown as IDatabaseManager;

    const manifest = new TenantArchiveManifest(
      1, '2026-01-01T00:00:00.000Z', '0.0.0', 'tenant',
      { id: 'widgets-cycle', slug: 'widgets-cycle', primaryHost: 'widgets-cycle.test', hostAliases: [], state: 'active', kind: 'site', appearance: '' },
      [], null,
      [
        { name: 'fcp_widgets_a', rows: 1, columns: ['id', 'link'], hasSerialId: true },
        { name: 'fcp_widgets_b', rows: 1, columns: ['id', 'link'], hasSerialId: true },
      ],
      0, { count: 0, bytes: 0 }, [],
    );
    const reader = {
      manifest,
      rows: async function* rows(table: string) { for (const row of rowsByTable[table] ?? []) yield row; },
      users: async function* users() { /* none */ },
      fileNames: () => [],
      filePath: () => null,
      close: () => undefined,
    } as unknown as TenantArchiveReader;

    const registry = {
      create: vi.fn(async () => ({ id: 'tenant-1', slug: 'widgets-cycle' })),
      remove: vi.fn(async () => undefined),
    } as unknown as TenantRegistryService;

    const identity = TenantIdentity.from({ id: 'tenant-1', slug: 'widgets-cycle', primaryHost: 'widgets-cycle.test', kind: 'site' });
    const plan = new TenantImportPlan(manifest, [], [], null, { total: 0, existing: 0, toCreate: 0 }, { count: 0, bytes: 0, colliding: 0 }, [], []);

    await new TenantImportExecutor(db, registry, tables, '/tmp/fc-executor-test-uploads').execute(reader, identity, plan);

    const bRow = insertedRows.fcp_widgets_b[0];
    // Not the archived id (1) and not `null` — the NEW id "a"'s row 1 was allocated, even though "b"
    // (and its reference to "a") was inserted first.
    expect(bRow.link).toBe(bases.fcp_widgets_a_id_seq + 1);
  });
});
