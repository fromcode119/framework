import { describe, expect, it, vi } from 'vitest';
import { EntityFactsRegistryService } from '@core/services/entity-facts/entity-facts-registry-service';

/** A product's rating, held by the plugin with the reviews, asked for by the plugin with the products. */
describe('EntityFactsRegistryService', () => {
  const rating = (values: Record<string, unknown>) => vi.fn(async (ids: string[]) => Object.fromEntries(ids.filter((id) => id in values).map((id) => [id, values[id]])));

  it('answers a fact for the ids asked, by entity kind', async () => {
    const registry = new EntityFactsRegistryService();
    registry.register({ namespace: 'org.x', pluginSlug: 'reviews', entity: 'product', fact: 'rating', resolve: rating({ 11: { average: 5, count: 1 } }) });
    expect(await registry.resolve('product', 'rating', [11, 12])).toEqual({ 11: { average: 5, count: 1 } });
    expect(await registry.resolve('course', 'rating', [11])).toEqual({});
  });

  it('a second provider fills only what the first did not know', async () => {
    const registry = new EntityFactsRegistryService();
    const second = rating({ 11: 'second', 12: 'second' });
    registry.register({ namespace: 'org.x', pluginSlug: 'a', entity: 'product', fact: 'rating', resolve: rating({ 11: 'first' }) });
    registry.register({ namespace: 'org.x', pluginSlug: 'b', entity: 'product', fact: 'rating', resolve: second });
    expect(await registry.resolve('product', 'rating', ['11', '12'])).toEqual({ 11: 'first', 12: 'second' });
    expect(second).toHaveBeenCalledWith(['12']);
  });

  it('a provider that throws answers nothing and does not stop the others', async () => {
    const registry = new EntityFactsRegistryService();
    registry.register({ namespace: 'org.x', pluginSlug: 'a', entity: 'product', fact: 'rating', resolve: async () => { throw new Error('down'); } });
    registry.register({ namespace: 'org.x', pluginSlug: 'b', entity: 'product', fact: 'rating', resolve: rating({ 11: 4 }) });
    expect(await registry.resolve('product', 'rating', [11])).toEqual({ 11: 4 });
  });

  it('re-registering replaces, and a plugin can be withdrawn', async () => {
    const registry = new EntityFactsRegistryService();
    registry.register({ namespace: 'org.x', pluginSlug: 'a', entity: 'product', fact: 'rating', resolve: rating({ 11: 1 }) });
    registry.register({ namespace: 'org.x', pluginSlug: 'a', entity: 'product', fact: 'rating', resolve: rating({ 11: 2 }) });
    expect(await registry.resolve('product', 'rating', [11])).toEqual({ 11: 2 });
    expect(registry.has('product', 'rating')).toBe(true);
    registry.unregisterByPlugin('org.x', 'a');
    expect(registry.has('product', 'rating')).toBe(false);
  });

  it('refuses a registration without a resolver', () => {
    expect(new EntityFactsRegistryService().register({ pluginSlug: 'a', entity: 'product', fact: 'rating' })).toBeNull();
  });
});
