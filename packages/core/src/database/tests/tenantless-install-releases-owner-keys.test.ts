import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchemaTenantIsolationService } from '@core/database/schema-tenant-isolation-service';
import { TenantMode } from '@core/tenant/tenant-mode';

/** With no tenants, the site comes out of the key of every table that is the installation's own. */
describe('the isolation sweep on a deployment with no tenants', () => {
  afterEach(() => vi.restoreAllMocks());

  const sweepOver = (policed: string[], enabled: boolean) => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(enabled);
    const releaseOwnerKey = vi.fn(async (table: string) => table !== 'pages');
    const db = {
      supportsTenantIsolation: () => true,
      getTables: async () => ['people', 'media', 'pages', '_system_tenant_plugins', 'settings_store', 'kept_isolated'],
      tenantIsolation: { listPolicies: async () => policed.map((table) => ({ table, policy: 'tenant_isolation' })), releaseOwnerKey },
    };
    const logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    const sweep = new SchemaTenantIsolationService(db as never, logger as never);
    vi.spyOn(sweep as any, 'removeTenantIsolation').mockResolvedValue(undefined);
    return { sweep, releaseOwnerKey, logger };
  };

  it('releases the installation\'s own tables — not system tables, and not one whose isolation was kept', async () => {
    const { sweep, releaseOwnerKey, logger } = sweepOver(['kept_isolated'], false);

    await sweep.applyTenantIsolationSweep(new Set(['settings_store']));

    expect(releaseOwnerKey.mock.calls.map(([table]) => table)).toEqual(['people', 'media', 'pages']);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('2 table(s) are keyed without a site again: people, media'));
  });

  it('touches no key while tenants exist', async () => {
    const { sweep, releaseOwnerKey } = sweepOver([], true);
    vi.spyOn(sweep as any, 'applyTenantIsolation').mockResolvedValue(undefined);
    vi.spyOn(sweep as any, 'applyBespokeTenantPolicies').mockResolvedValue(undefined);

    await sweep.applyTenantIsolationSweep(new Set());

    expect(releaseOwnerKey).not.toHaveBeenCalled();
  });
});
