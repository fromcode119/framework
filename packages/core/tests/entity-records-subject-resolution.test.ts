import { describe, it, expect } from 'vitest';
import { PluginEntityRecordsRegistryService } from '@core/services/entity-records/plugin-entity-records-registry-service';
import { EntityRecordsResolutionService } from '@core/services/entity-records/entity-records-resolution-service';

/**
 * A person ref and a subject ref must never reach the same providers. An order subject carries the
 * customer's email, so a person provider seeing it would put that customer's whole invoice history on
 * one order — plausible-looking and completely wrong.
 */
const item = (id: string) => ({ id, group: 'G', kind: 'k', title: id, date: '2026-01-01' });

const build = () => {
  const registry = new PluginEntityRecordsRegistryService();
  const seen: Record<string, any[]> = { person: [], linked: [], other: [] };
  registry.register({
    namespace: 'org.test', pluginSlug: 'a', key: 'person', label: 'Person',
    resolve: async (ref) => { seen.person.push(ref); return [item('person-1')]; },
  });
  registry.register({
    namespace: 'org.test', pluginSlug: 'b', key: 'linked', label: 'Linked', matchKeys: ['orderNumber'],
    resolve: async (ref) => { seen.linked.push(ref); return [item('linked-1')]; },
  });
  registry.register({
    namespace: 'org.test', pluginSlug: 'c', key: 'other', label: 'Other', matchKeys: ['shipmentCode'],
    resolve: async (ref) => { seen.other.push(ref); return [item('other-1')]; },
  });
  return { registry, seen, service: new EntityRecordsResolutionService(registry) };
};

const subject = { kind: 'org.test:x:order', id: '7', keys: { orderNumber: 'ORD-1' } };

describe('EntityRecordsResolutionService — person vs subject', () => {
  it('a person ref reaches only providers that declared no matchKeys', async () => {
    const { seen, service } = build();
    const result = await service.resolve({ personId: 1, email: 'A@Example.com ' });
    expect(result.items.map((i) => i.id)).toEqual(['person-1']);
    expect(seen.linked).toHaveLength(0);
    expect(seen.other).toHaveLength(0);
    expect(seen.person[0].email).toBe('a@example.com');
  });

  it('a subject ref reaches only providers whose matchKey the subject offers', async () => {
    const { seen, service } = build();
    const result = await service.resolve({ subject });
    expect(result.items.map((i) => i.id)).toEqual(['linked-1']);
    expect(seen.person).toHaveLength(0);
    expect(seen.other).toHaveLength(0);
    expect(seen.linked[0].subject).toEqual(subject);
  });

  it('strips person fields from a subject ref so nothing can match on them', async () => {
    const { seen, service } = build();
    await service.resolve({ subject, email: 'a@example.com', userId: 4, personId: 9 } as any);
    expect(seen.linked[0]).toEqual({ personId: null, userId: null, email: null, subject });
  });

  it('drops empty correlation keys — matching one would answer for every record', async () => {
    const { seen, service } = build();
    const result = await service.resolve({ subject: { kind: 'k', id: '1', keys: { orderNumber: '  ' } } });
    expect(result.items).toEqual([]);
    expect(seen.linked).toHaveLength(0);
  });

  it('an incomplete subject resolves to nothing rather than falling back to the person providers', async () => {
    const { seen, service } = build();
    const result = await service.resolve({ subject: { kind: '', id: '', keys: {} }, email: 'a@example.com' });
    expect(result.items.map((i) => i.id)).toEqual(['person-1']);
    expect(seen.linked).toHaveLength(0);
  });

  it('isolates a throwing provider and still returns the rest', async () => {
    const { registry, service } = build();
    registry.register({
      namespace: 'org.test', pluginSlug: 'd', key: 'boom', label: 'Boom', matchKeys: ['orderNumber'],
      resolve: async () => { throw new Error('nope'); },
    });
    const result = await service.resolve({ subject });
    expect(result.items.map((i) => i.id)).toEqual(['linked-1']);
    expect(result.errors).toHaveLength(1);
  });
});
