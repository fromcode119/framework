import { describe, expect, it, vi } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';
import { IntegrationsContextProxy } from '@core/plugin/context/integrations';
import { JobsContextProxy } from '@core/plugin/context/jobs';

/**
 * A plugin's cache and redis entries are per SITE, not only per plugin.
 *
 * The plugin slug was the whole namespace, so a plugin serving many sites from one shared cache wrote
 * every site's value under the same key — one customer's cached answer served to the next site that
 * asked. And any redis command that was not a single-key one ran unprefixed on the shared redis.
 */
const plugin = { manifest: { slug: 'shop' } } as any;
const inSite = <T>(tenantId: string, fn: () => T) => RequestContextUtils.storage.run({ tenantId } as any, fn);

const security = (capabilities: string[]) => ({
  hasCapability: (cap: string) => capabilities.includes(cap),
  handleViolation: vi.fn((cap: string) => { throw new Error(`Security Violation: Missing "${cap}" capability.`); }),
  handleRateLimit: vi.fn(),
}) as any;

describe('plugin keyspace', () => {
  it('keeps two sites\' cache entries apart, and work outside a request apart from both', async () => {
    const store = new Map<string, unknown>();
    const cache = { get: async (key: string) => store.get(key), set: async (key: string, value: unknown) => { store.set(key, value); }, del: async () => undefined };
    const proxy = IntegrationsContextProxy.createCacheProxy(plugin, { integrations: { cache } } as any, security(['cache']))!;

    await inSite('acme', () => proxy.set('price', 10));
    await inSite('globex', () => proxy.set('price', 99));

    expect(await inSite('acme', () => proxy.get('price'))).toBe(10);
    expect(await inSite('globex', () => proxy.get('price'))).toBe(99);
    expect(await proxy.get('price')).toBeUndefined();
    expect([...store.keys()].sort()).toEqual(['cache:acme:shop:price', 'cache:globex:shop:price']);
  });

  it('prefixes a single-key redis command with the site and the plugin', async () => {
    const redis = { get: vi.fn(async (key: string) => key) };
    const proxy: any = JobsContextProxy.createRedisProxy(plugin, { jobs: { redis } } as any, security(['jobs']));
    expect(await inSite('acme', () => proxy.get('counter'))).toBe('redis:acme:shop:counter');
  });

  it('refuses a redis command that reaches beyond one key without the global capability', () => {
    const redis = { keys: vi.fn(async () => []), flushdb: vi.fn(async () => 'OK') };
    const guard = security(['jobs']);
    const proxy: any = JobsContextProxy.createRedisProxy(plugin, { jobs: { redis } } as any, guard);
    expect(() => proxy.keys('*')).toThrow(/redis:global/);
    expect(() => proxy.flushdb()).toThrow(/redis:global/);
    expect(redis.keys).not.toHaveBeenCalled();
    expect(redis.flushdb).not.toHaveBeenCalled();

    const trusted: any = JobsContextProxy.createRedisProxy(plugin, { jobs: { redis } } as any, security(['jobs', 'redis:global']));
    trusted.keys('*');
    expect(redis.keys).toHaveBeenCalledWith('*');
  });
});
