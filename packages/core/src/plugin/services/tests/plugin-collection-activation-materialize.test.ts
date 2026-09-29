import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';
import { PerTenantRun } from '@core/tenant/per-tenant-run';
import { PluginCollectionActivationService } from '@core/plugin/services/plugin-collection-activation-service';
import { PluginDefaultPageMaterializationRuntimeService } from '@core/services/default-page-contract/plugin-default-page-materialization-runtime-service';

/**
 * Default pages are site content: they are created inside a SITE. A request bound to one runs there; a
 * platform request (a plugin switched on for the whole platform) has no site and used to write rows
 * row-level security refused — it runs once per site, like boot.
 */
describe('PluginCollectionActivationService.materializeDefaultPages', () => {
  afterEach(() => vi.restoreAllMocks());

  const service = () => new PluginCollectionActivationService(
    { db: {}, themeManager: null } as any, {} as any, {} as any,
    { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } as any,
  );

  const spies = () => ({
    direct: vi.spyOn(PluginDefaultPageMaterializationRuntimeService.prototype, 'materialize').mockResolvedValue(null),
    perSite: vi.spyOn(PerTenantRun, 'forEach').mockResolvedValue(1),
  });

  it('runs inside the site a request is bound to', async () => {
    const { direct, perSite } = spies();
    await RequestContextUtils.storage.run({ tenantId: 'shop' } as any, () => service().materializeDefaultPages('catalog-module'));
    expect(direct).toHaveBeenCalledWith('catalog-module');
    expect(perSite).not.toHaveBeenCalled();
  });

  it('runs once per site for a platform request that has no site', async () => {
    const { direct, perSite } = spies();
    await RequestContextUtils.storage.run({} as any, () => service().materializeDefaultPages('catalog-module'));
    expect(perSite).toHaveBeenCalledTimes(1);
    expect(direct).not.toHaveBeenCalled();
  });

  it('runs once per site with no request at all (boot)', async () => {
    const { perSite } = spies();
    await service().materializeDefaultPages();
    expect(perSite).toHaveBeenCalledTimes(1);
  });
});
