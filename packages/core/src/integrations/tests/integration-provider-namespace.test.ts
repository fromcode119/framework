import { describe, expect, it } from 'vitest';
import { IntegrationStoredProviderService } from '@core/integrations/integration-stored-provider-service';
import { IntegrationsContextProxy } from '@core/plugin/context/integrations';

/**
 * A saved provider entry must say which plugin's namespace the provider lives in. The admin save
 * rebuilt entries field by field and dropped it, so logistics could no longer find its courier plugin
 * and every Econt office search on that site answered "not configured".
 */
const setup = () => {
  const rows = new Map<string, any>();
  const db = { async findOne(_t: string, q: { key: string }) { return rows.get(q.key) || null; } };
  const econt = { key: 'econt', label: 'Econt', fields: [], create: () => ({}), namespace: 'org.fromcode' };
  const types = new Map<string, any>([['shipping_provider', {
    definition: { key: 'shipping_provider', label: 'Shipping', defaultProvider: 'econt', allowMultipleActiveProviders: false, providers: [econt] },
    providers: new Map([['econt', econt]]),
  }]]);
  const profileService = {
    normalize: (v: string) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
    getProvidersSettingKey: (t: string) => `integration_${t}_providers`,
    safeParseJson: (v: string, f: any) => { try { return JSON.parse(v); } catch { return f; } },
    validateProviderConfig() {},
    async upsertMeta(entry: any) { rows.set(entry.key, entry); },
  };
  const service = new IntegrationStoredProviderService(db, { warn() {} } as any, types, profileService as any);
  return { rows, service };
};

describe('integration provider namespace', () => {
  it('an admin save of an entry that lost its namespace writes it back from the registration', async () => {
    const { rows, service } = setup();
    rows.set('integration_shipping_provider_providers', {
      key: 'integration_shipping_provider_providers',
      value: JSON.stringify({ providers: [{ id: 'econt-default', providerKey: 'econt', config: {}, enabled: true }] }),
    });
    await service.updateStoredConfig('shipping_provider', 'econt', {}, { providerId: 'econt-default', makeActive: true, enabled: true });
    const stored = JSON.parse(rows.get('integration_shipping_provider_providers').value);
    expect(stored.providers[0]).toMatchObject({ id: 'econt-default', providerKey: 'econt', namespace: 'org.fromcode' });
  });

  it('reading keeps it, so the next write carries it', async () => {
    const { rows, service } = setup();
    rows.set('integration_shipping_provider_providers', {
      key: 'integration_shipping_provider_providers',
      value: JSON.stringify({ providers: [{ id: 'econt-default', providerKey: 'econt', config: {} }] }),
    });
    const read = await service.readStoredProvidersInternal('shipping_provider');
    expect(read?.[0]?.namespace).toBe('org.fromcode');
  });

  it('registering a provider stamps the registering plugin\'s namespace', () => {
    let registered: any = null;
    const manager: any = { integrations: { registerProvider: (_type: string, provider: any) => { registered = provider; } } };
    const plugin: any = { manifest: { slug: 'logistics-econt', namespace: 'org.fromcode' } };
    const proxy = IntegrationsContextProxy.createIntegrationsProxy(plugin, manager, { hasCapability: () => true, handleViolation: () => {} } as any);
    proxy.registerProvider('shipping_provider', { key: 'econt', label: 'Econt', create: () => ({}) });
    expect(registered).toMatchObject({ key: 'econt', namespace: 'org.fromcode' });
  });
});
