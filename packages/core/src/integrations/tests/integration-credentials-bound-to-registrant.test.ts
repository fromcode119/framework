import { describe, expect, it } from 'vitest';
import { IntegrationRegistry } from '@core/integrations/integration-registry';

/**
 * Stored credentials belong to the plugin that held the provider when they were saved. Whoever
 * registers a provider key first at boot is not thereby handed credentials saved for someone else.
 */
const KEY = 'integration_sms_providers';

function registryWith(rows: Map<string, any>) {
  const db = {
    async findOne(_table: string, query: { key: string }) { return rows.get(query.key) ?? null; },
    async find() { return []; },
    async insert(_table: string, row: any) { rows.set(row.key, row); return row; },
    async update(_table: string, where: any, patch: any) { rows.set(where.key, { ...rows.get(where.key), ...patch }); return patch; },
  };
  const registry = new IntegrationRegistry(db as any);
  registry.registerType({ key: 'sms', label: 'Text messages', defaultProvider: 'none', providers: [{ key: 'none', label: 'Not set up', fields: [], create: () => ({ kind: 'none' }) }] } as any);
  return registry;
}

const provider = (seen: Array<Record<string, unknown>>) => ({
  key: 'twilio', label: 'Twilio', fields: [{ name: 'token', label: 'Token', type: 'text' }],
  create: (config: Record<string, unknown>) => { seen.push(config); return { kind: 'twilio' }; },
});

describe('stored integration credentials', () => {
  it('are bound to the plugin that registered the provider when they were saved', async () => {
    const rows = new Map<string, any>();
    const seen: Array<Record<string, unknown>> = [];
    const first = registryWith(rows);
    first.registerProvider('sms', provider(seen) as any, 'sms-twilio');
    await first.updateStoredConfig('sms', 'twilio', { token: 'saved-for-twilio' }, { makeActive: true });
    expect(JSON.stringify(rows.get(KEY)?.value)).toContain('sms-twilio');

    // The next boot: the same plugin registers it and gets its credentials.
    const sameOwner = registryWith(rows);
    sameOwner.registerProvider('sms', provider(seen) as any, 'sms-twilio');
    expect((await sameOwner.instantiate('sms')).resolved.providerKey).toBe('twilio');

    // A boot where another plugin reached the key first: it is not handed them.
    const other: Array<Record<string, unknown>> = [];
    const impostor = registryWith(rows);
    impostor.registerProvider('sms', provider(other) as any, 'someone-else');
    const { resolved } = await impostor.instantiate('sms');
    expect(resolved.providerKey).toBe('none');
    expect(other).toHaveLength(0);
  });
});
