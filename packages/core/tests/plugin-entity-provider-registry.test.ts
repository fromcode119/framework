import { describe, it, expect } from 'vitest';
import { PluginEntityProviderRegistry } from '@core/services/entities/plugin-entity-provider-registry';

/**
 * Registration order is the whole point: lms can register before ecommerce, so a consumer must resolve
 * whether its provider arrived first or last.
 */
const consumer = (relationToEntity: string) => ({
  slug: 'lms-courses',
  fields: [{ name: 'product', type: 'relationship', relationToEntity }],
}) as any;

const provider = () => ({ slug: 'ecommerce-products', entity: 'product', fields: [] }) as any;

describe('PluginEntityProviderRegistry', () => {
  it('resolves a consumer registered AFTER its provider', () => {
    const registry = new PluginEntityProviderRegistry();
    registry.registerProvider(provider(), 'ecommerce');
    const c = consumer('product');
    expect(registry.resolveConsumer(c, 'lms')).toEqual([]);
    expect(c.fields[0].relationTo).toBe('ecommerce-products');
  });

  it('resolves a consumer registered BEFORE its provider, when the provider arrives', () => {
    const registry = new PluginEntityProviderRegistry();
    const c = consumer('product');
    expect(registry.resolveConsumer(c, 'lms')).toEqual(['product']);
    expect(c.fields[0].relationTo).toBeUndefined();
    registry.registerProvider(provider(), 'ecommerce');
    expect(c.fields[0].relationTo).toBe('ecommerce-products');
  });

  it('leaves the field unresolved when nothing provides the entity', () => {
    const registry = new PluginEntityProviderRegistry();
    const c = consumer('nobody-provides-this');
    expect(registry.resolveConsumer(c, 'lms')).toEqual(['nobody-provides-this']);
    expect(c.fields[0].relationTo).toBeUndefined();
    expect(registry.providerSlug('nobody-provides-this')).toBeNull();
  });

  it('never overwrites an explicit relationTo', () => {
    const registry = new PluginEntityProviderRegistry();
    registry.registerProvider(provider(), 'ecommerce');
    const c = { slug: 'x', fields: [{ name: 'p', relationToEntity: 'product', relationTo: 'something-else' }] } as any;
    registry.resolveConsumer(c, 'lms');
    expect(c.fields[0].relationTo).toBe('something-else');
  });

  it('resolves a relationship nested inside a group field', () => {
    const registry = new PluginEntityProviderRegistry();
    registry.registerProvider(provider(), 'ecommerce');
    const c = { slug: 'x', fields: [{ name: 'tiers', type: 'array', fields: [{ name: 'p', relationToEntity: 'product' }] }] } as any;
    registry.resolveConsumer(c, 'mlm');
    expect(c.fields[0].fields[0].relationTo).toBe('ecommerce-products');
  });

  it('treats the entity key case-insensitively', () => {
    const registry = new PluginEntityProviderRegistry();
    registry.registerProvider({ slug: 'ecommerce-orders', entity: 'Order', fields: [] } as any, 'ecommerce');
    const c = consumer('order');
    registry.resolveConsumer(c, 'subscriptions');
    expect(c.fields[0].relationTo).toBe('ecommerce-orders');
  });

  /**
   * The real boot order on this install: social-proof, subscriptions and logistics all registered
   * BEFORE ecommerce and parked on `order`. One provider arriving has to release every one of them,
   * not just the first.
   */
  it('drains every consumer parked on the same entity when the provider arrives', () => {
    const registry = new PluginEntityProviderRegistry();
    const parked = ['social-proof', 'subscriptions', 'logistics'].map((slug) => {
      const c = { slug: `${slug}-thing`, fields: [{ name: 'order', relationToEntity: 'order' }] } as any;
      expect(registry.resolveConsumer(c, slug)).toEqual(['order']);
      return c;
    });
    expect(parked.every((c) => c.fields[0].relationTo === undefined)).toBe(true);

    registry.registerProvider({ slug: 'ecommerce-orders', entity: 'order', fields: [] } as any, 'ecommerce');

    expect(parked.map((c) => c.fields[0].relationTo)).toEqual([
      'ecommerce-orders', 'ecommerce-orders', 'ecommerce-orders',
    ]);
  });

  it('does not re-resolve a consumer twice when a second provider registration replaces the first', () => {
    const registry = new PluginEntityProviderRegistry();
    const c = consumer('product');
    registry.resolveConsumer(c, 'lms');
    registry.registerProvider(provider(), 'ecommerce');
    expect(c.fields[0].relationTo).toBe('ecommerce-products');
    registry.registerProvider({ slug: 'other-products', entity: 'product', fields: [] } as any, 'other');
    // Already drained, so the settled field keeps what it resolved to rather than silently moving.
    expect(c.fields[0].relationTo).toBe('ecommerce-products');
    expect(registry.providerSlug('product')).toBe('other-products');
  });
});
