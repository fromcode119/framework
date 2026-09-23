import { describe, it, expect } from 'vitest';
import { PluginEntityProviderRegistry } from '@core/services/entities/plugin-entity-provider-registry';

/**
 * Registration order is the whole point: a courses plugin can register before a catalog plugin, so a
 * consumer must resolve whether its provider arrived first or last.
 */
const consumer = (relationToEntity: string) => ({
  slug: 'courses-lessons',
  fields: [{ name: 'product', type: 'relationship', relationToEntity }],
}) as any;

const provider = () => ({ slug: 'catalog-products', entity: 'product', fields: [] }) as any;

describe('PluginEntityProviderRegistry', () => {
  it('resolves a consumer registered AFTER its provider', () => {
    const registry = new PluginEntityProviderRegistry();
    registry.registerProvider(provider(), 'catalog');
    const c = consumer('product');
    expect(registry.resolveConsumer(c, 'courses')).toEqual([]);
    expect(c.fields[0].relationTo).toBe('catalog-products');
  });

  it('resolves a consumer registered BEFORE its provider, when the provider arrives', () => {
    const registry = new PluginEntityProviderRegistry();
    const c = consumer('product');
    expect(registry.resolveConsumer(c, 'courses')).toEqual(['product']);
    expect(c.fields[0].relationTo).toBeUndefined();
    registry.registerProvider(provider(), 'catalog');
    expect(c.fields[0].relationTo).toBe('catalog-products');
  });

  it('leaves the field unresolved when nothing provides the entity', () => {
    const registry = new PluginEntityProviderRegistry();
    const c = consumer('nobody-provides-this');
    expect(registry.resolveConsumer(c, 'courses')).toEqual(['nobody-provides-this']);
    expect(c.fields[0].relationTo).toBeUndefined();
    expect(registry.providerSlug('nobody-provides-this')).toBeNull();
  });

  it('never overwrites an explicit relationTo', () => {
    const registry = new PluginEntityProviderRegistry();
    registry.registerProvider(provider(), 'catalog');
    const c = { slug: 'x', fields: [{ name: 'p', relationToEntity: 'product', relationTo: 'something-else' }] } as any;
    registry.resolveConsumer(c, 'courses');
    expect(c.fields[0].relationTo).toBe('something-else');
  });

  it('resolves a relationship nested inside a group field', () => {
    const registry = new PluginEntityProviderRegistry();
    registry.registerProvider(provider(), 'catalog');
    const c = { slug: 'x', fields: [{ name: 'tiers', type: 'array', fields: [{ name: 'p', relationToEntity: 'product' }] }] } as any;
    registry.resolveConsumer(c, 'referrals');
    expect(c.fields[0].fields[0].relationTo).toBe('catalog-products');
  });

  it('treats the entity key case-insensitively', () => {
    const registry = new PluginEntityProviderRegistry();
    registry.registerProvider({ slug: 'catalog-orders', entity: 'Order', fields: [] } as any, 'catalog');
    const c = consumer('order');
    registry.resolveConsumer(c, 'memberships');
    expect(c.fields[0].relationTo).toBe('catalog-orders');
  });

  /**
   * The real boot order on one install: three consumers registered BEFORE the catalog plugin and
   * parked on `order`. One provider arriving has to release every one of them, not just the first.
   */
  it('drains every consumer parked on the same entity when the provider arrives', () => {
    const registry = new PluginEntityProviderRegistry();
    const parked = ['reviews', 'memberships', 'shipping'].map((slug) => {
      const c = { slug: `${slug}-thing`, fields: [{ name: 'order', relationToEntity: 'order' }] } as any;
      expect(registry.resolveConsumer(c, slug)).toEqual(['order']);
      return c;
    });
    expect(parked.every((c) => c.fields[0].relationTo === undefined)).toBe(true);

    registry.registerProvider({ slug: 'catalog-orders', entity: 'order', fields: [] } as any, 'catalog');

    expect(parked.map((c) => c.fields[0].relationTo)).toEqual([
      'catalog-orders', 'catalog-orders', 'catalog-orders',
    ]);
  });

  it('does not re-resolve a consumer twice when a second provider registration replaces the first', () => {
    const registry = new PluginEntityProviderRegistry();
    const c = consumer('product');
    registry.resolveConsumer(c, 'courses');
    registry.registerProvider(provider(), 'catalog');
    expect(c.fields[0].relationTo).toBe('catalog-products');
    registry.registerProvider({ slug: 'other-products', entity: 'product', fields: [] } as any, 'other');
    // Already drained, so the settled field keeps what it resolved to rather than silently moving.
    expect(c.fields[0].relationTo).toBe('catalog-products');
    expect(registry.providerSlug('product')).toBe('other-products');
  });
});
