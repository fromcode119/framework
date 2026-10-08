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

describe('context.collections.create', () => {
  afterEach(() => {
    // The bridge is process-global; leave no creator behind for other suites.
    CollectionWriteBridge.installCreate(undefined as any);
  });

  it('refuses a collection this plugin does not own', async () => {
    CollectionWriteBridge.installCreate(vi.fn());
    const manager = buildManager({ fcp_alpha_products: { pluginSlug: 'beta' } });
    await expect(proxy(manager).create('products', { name: 'x' })).rejects.toThrow(/may create only its own collections/);
  });

  it('refuses an unregistered collection', async () => {
    CollectionWriteBridge.installCreate(vi.fn());
    const manager = buildManager({});
    await expect(proxy(manager).create('ghosts', { name: 'x' })).rejects.toThrow(/own collections/);
  });

  it('fails CLOSED before the api installs the bridge', async () => {
    const manager = buildManager({ fcp_alpha_products: { pluginSlug: 'alpha' } });
    await expect(proxy(manager).create('products', { name: 'x' })).rejects.toThrow(/bridge/);
  });

  it('forwards an owned-collection create to the installed creator with the acting user', async () => {
    const creator = vi.fn(async () => ({ id: 12, name: 'new' }));
    CollectionWriteBridge.installCreate(creator);
    const manager = buildManager({ fcp_alpha_products: { pluginSlug: 'alpha' } });

    const result = await proxy(manager).create('products', { name: 'new' }, { user: { id: 1, roles: ['admin'] } });

    expect(creator).toHaveBeenCalledWith('fcp_alpha_products', { name: 'new' }, { id: 1, roles: ['admin'] });
    expect(result).toEqual({ id: 12, name: 'new' });
  });

  it('keeps create and update on separate installs', async () => {
    const writer = vi.fn(async () => ({ id: 1 }));
    CollectionWriteBridge.install(writer);
    const manager = buildManager({ fcp_alpha_products: { pluginSlug: 'alpha' } });
    await expect(proxy(manager).create('products', { name: 'x' })).rejects.toThrow(/bridge/);
    expect(writer).not.toHaveBeenCalled();
    CollectionWriteBridge.install(undefined as any);
  });
});
