import { describe, expect, it, vi } from 'vitest';
import type { IDatabaseManager } from '@fromcode119/database';
import { StandaloneImportExecutor } from '@core/tenant/provisioning/standalone-import-executor';
import type { TenantArchiveReader } from '@core/tenant/provisioning/tenant-archive-reader';

/**
 * Taking a site back OFF the platform.
 *
 * A site could always come on; nothing took one off, so an archive exported from a site was consumable
 * by nothing except another platform. These tests are about the two ways a destination can fail to be
 * a standalone deployment — both of which must be said BEFORE a row is written, because the
 * alternative is a raw "violates row-level security policy" from whichever table happened to be first.
 */
describe('StandaloneImportExecutor', () => {
  const reader = (): TenantArchiveReader => ({
    manifest: { tenant: { slug: 'shop' }, tableNames: [], tables: [] },
    rows: async function* rows() { /* none */ },
    users: async function* users() { /* none */ },
    fileNames: () => [],
    filePath: () => null,
    close: () => undefined,
  } as unknown as TenantArchiveReader);

  const db = (tenants: number, policies: Array<{ table: string; policy: string }> = []): IDatabaseManager => ({
    queryRaw: vi.fn(async (sql: string) => (sql.includes('_system_tenants') ? [{ tenants }] : [])),
    execute: vi.fn(async () => []),
    supportsTenantIsolation: () => true,
    tenantIsolation: { listPolicies: vi.fn(async () => policies) },
  } as unknown as IDatabaseManager);

  it('refuses a destination that still has sites', async () => {
    const executor = new StandaloneImportExecutor(db(3), [], '/tmp/uploads');

    await expect(executor.execute(reader())).rejects.toThrow(/already has 3 site\(s\)/);
  });

  /**
   * The one a real run hit. The policies check every insert against the connection's current site, and
   * an un-owned row matches none — so every insert fails, one table at a time. A deployment with no
   * sites releases them at its next boot; saying that is the useful answer.
   */
  it('refuses a destination that still carries tenant isolation, naming what to do', async () => {
    const policies = [{ table: 'fcp_orbit_pages', policy: 'p1' }, { table: 'users', policy: 'p2' }];
    const executor = new StandaloneImportExecutor(db(0, policies), [], '/tmp/uploads');

    await expect(executor.execute(reader())).rejects.toThrow(/still carry tenant isolation/);
    await expect(executor.execute(reader())).rejects.toThrow(/booting it once releases that isolation/);
  });

  /** No sites and no policies IS a standalone deployment — nothing to refuse. */
  it('proceeds on a deployment with no sites and no isolation', async () => {
    const executor = new StandaloneImportExecutor(db(0, []), [], '/tmp/uploads');

    await expect(executor.execute(reader())).resolves.toEqual({});
  });

  /**
   * A driver with no isolation strategy has no policies to list, and asking would REFUSE rather than
   * answer — that is the whole point of the refusing default. Single-site by construction, so there is
   * nothing here to check for.
   */
  it('does not ask about isolation on a driver that has none', async () => {
    const manager = db(0, []);
    (manager as unknown as { supportsTenantIsolation: () => boolean }).supportsTenantIsolation = () => false;

    await expect(new StandaloneImportExecutor(manager, [], '/tmp/uploads').execute(reader())).resolves.toEqual({});
    expect((manager.tenantIsolation.listPolicies as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });
});
