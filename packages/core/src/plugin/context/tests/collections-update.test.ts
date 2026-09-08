import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollectionsContextProxy } from '@core/plugin/context/collections';
import { CollectionWriteBridge } from '@core/plugin/collection-write-bridge';
import { Logger } from '@core/logging';

const plugin = { manifest: { slug: 'alpha', name: 'alpha', version: '1.0.0' } } as any;
const security = { hasCapability: () => true, handleViolation: vi.fn(), handleRateLimit: vi.fn() } as any;

const buildManager = (entries: Record<string, { pluginSlug: string }>) => ({
  getCollection: (slug: string) => entries[slug] ? { collection: { slug }, pluginSlug: entries[slug].pluginSlug } : null,
  registeredCollections: new Map(),
  emit: vi.fn(),
}) as any;

const proxy = (manager: any) => CollectionsContextProxy.createCollectionsProxy(plugin, manager, new Logger({ namespace: 'test' }), security) as any;

describe('context.collections.update', () => {
  afterEach(() => {
    // The bridge is process-global; leave no writer behind for other suites.
    CollectionWriteBridge.install(undefined as any);
  });

  it('refuses a collection this plugin does not own', async () => {
    const manager = buildManager({ fcp_alpha_products: { pluginSlug: 'beta' } });
    await expect(proxy(manager).update('products', 1, { name: 'x' })).rejects.toThrow(/own collections/);
  });

  it('refuses an unregistered collection', async () => {
    const manager = buildManager({});
    await expect(proxy(manager).update('ghosts', 1, { name: 'x' })).rejects.toThrow(/own collections/);
  });

  it('fails CLOSED before the api installs the bridge', async () => {
    CollectionWriteBridge.install(undefined as any);
    const manager = buildManager({ fcp_alpha_products: { pluginSlug: 'alpha' } });
    await expect(proxy(manager).update('products', 1, { name: 'x' })).rejects.toThrow(/bridge/);
  });

  it('forwards an owned-collection write to the installed writer with the acting user', async () => {
    const writer = vi.fn(async () => ({ id: 11, name: 'updated' }));
    CollectionWriteBridge.install(writer);
    const manager = buildManager({ fcp_alpha_products: { pluginSlug: 'alpha' } });

    const result = await proxy(manager).update('products', 11, { name: 'updated' }, { user: { id: 1, roles: ['admin'] } });

    expect(writer).toHaveBeenCalledWith('fcp_alpha_products', 11, { name: 'updated' }, { id: 1, roles: ['admin'] });
    expect(result).toEqual({ id: 11, name: 'updated' });
  });
});
