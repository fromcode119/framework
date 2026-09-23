import { describe, expect, it } from 'vitest';
import { PluginRuntimeStateService } from '@core/plugin/services/runtime/plugin-runtime-state-service';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * A plugin's settings are per SITE. The in-memory manifest is one object per plugin for the whole
 * process, so a site's save used to land there — and every other site's settings screen then showed
 * that site's issuer, IBAN and tax rate, and saving it wrote them into the other site's row.
 */
const build = (row: unknown) => {
  const plugin: any = { manifest: { slug: 'finance', config: { settings: { taxRatePercent: 0 } } } };
  const saved: unknown[] = [];
  const registry: any = {
    loadPluginConfig: async () => row,
    savePluginConfig: async (_slug: string, config: unknown) => { saved.push(config); },
  };
  const schema = { fields: [{ name: 'taxRatePercent' }, { name: 'invoiceIssuerUic' }] };
  const service = new PluginRuntimeStateService({} as any, {} as any, registry, new Map([['finance', plugin]]), new Map(), new Map(), new Map([['finance', schema]]));
  return { service, plugin, saved };
};

describe('plugin config is per site', () => {
  it('a SITE save writes the site row and leaves the process-wide manifest alone', async () => {
    const { service, plugin, saved } = build({});
    await RequestContextUtils.storage.run({ tenantId: 'site-a' }, () =>
      service.savePluginConfig('finance', { settings: { taxRatePercent: 20, invoiceIssuerUic: '201550322' } }));
    expect(saved).toHaveLength(1);
    expect(plugin.manifest.config.settings).toEqual({ taxRatePercent: 0 });
  });

  it('a PLATFORM save still refreshes the manifest copy', async () => {
    const { service, plugin } = build({});
    await service.savePluginConfig('finance', { settings: { taxRatePercent: 9 } });
    expect(plugin.manifest.config.settings).toEqual({ taxRatePercent: 9 });
  });

  it("reads the current scope's stored row — not the manifest — with legacy keys reconciled", async () => {
    const { service } = build({ settings: { tax_rate_percent: 20, invoiceIssuerUic: '201550322' }, other: 1 });
    const config = await service.loadPluginConfig('finance');
    expect(config.other).toBe(1);
    expect(config.settings).toMatchObject({ taxRatePercent: 20, invoiceIssuerUic: '201550322' });
  });
});
