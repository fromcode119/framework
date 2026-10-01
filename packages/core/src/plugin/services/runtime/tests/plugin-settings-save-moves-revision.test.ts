import { describe, expect, it, vi } from 'vitest';
import { PluginRuntimeStateService } from '@core/plugin/services/runtime/plugin-runtime-state-service';
import { SiteContentRevision } from '@core/tenant/site-content-revision';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';

/** A plugin's settings (a tax rate, a currency) can change what a page or a cached answer shows. */
describe('saving a plugin\'s settings', () => {
  it('moves the content revision of the site it was saved for', async () => {
    vi.spyOn(TenantMode, 'isEnabled').mockReturnValue(true);
    const registry: any = { savePluginConfig: vi.fn(async () => undefined) };
    const service = new PluginRuntimeStateService({ info: () => undefined } as any, {} as any, registry, new Map(), new Map(), new Map(), new Map());
    const before = SiteContentRevision.current('site-a');
    await RequestContextUtils.storage.run({ tenantId: 'site-a' } as any, () => service.savePluginConfig('ledger', { settings: { taxRatePercent: 20 } }));
    expect(registry.savePluginConfig).toHaveBeenCalledTimes(1);
    expect(SiteContentRevision.current('site-a')).not.toBe(before);
    vi.restoreAllMocks();
  });
});
