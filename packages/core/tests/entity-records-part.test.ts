import { describe, it, expect } from 'vitest';
import { PluginEntityRecordsRegistryService } from '@core/services/entity-records/plugin-entity-records-registry-service';
import { EntityRecordsResolutionService } from '@core/services/entity-records/entity-records-resolution-service';

/**
 * A provider says which PART of a record its records are. The term rides on every item it returns, so
 * the subject's own page can draw them inside the section it mapped that part to.
 */
const subject = { kind: 'org.test:x:order', id: '7', keys: { orderNumber: 'ORD-1' } };

const resolveWith = async (part: string | undefined, items: any[]) => {
  const registry = new PluginEntityRecordsRegistryService();
  registry.register({ namespace: 'org.test', pluginSlug: 'b', key: 'linked', label: 'Linked', matchKeys: ['orderNumber'], part, resolve: async () => items });
  return (await new EntityRecordsResolutionService(registry).resolve({ subject })).items;
};

describe('EntityRecordsResolutionService — part', () => {
  it('stamps the provider part on each item', async () => {
    const items = await resolveWith(' payment ', [{ id: 'a', group: 'G', kind: 'k', title: 'A' }]);
    expect(items[0].part).toBe('payment');
  });

  it('keeps the part an item names for itself', async () => {
    const items = await resolveWith('payment', [{ id: 'a', group: 'G', kind: 'k', title: 'A', part: 'delivery' }]);
    expect(items[0].part).toBe('delivery');
  });

  it('leaves the part unset for a provider that declares none', async () => {
    const items = await resolveWith(undefined, [{ id: 'a', group: 'G', kind: 'k', title: 'A' }]);
    expect(items[0].part).toBeUndefined();
  });
});
