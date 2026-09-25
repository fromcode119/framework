import { describe, expect, it } from 'vitest';
import { IntegrationManager } from '@core/integrations/integration-manager';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * A resolved integration instance carries ONE tenant's stored configuration — a courier's credentials,
 * a payment gateway's secret. The instance cache was keyed by integration type alone, so the first
 * resolver (often the untenanted boot) served every tenant afterwards: a site with courier credentials
 * read back an empty username because the platform-level record had won the cache, and the same sharing
 * would hand one tenant another tenant's live credential.
 */
class TenantCacheFixture {
  static manager(resolvedByTenant: Map<string | undefined, string>): IntegrationManager {
    const manager = new IntegrationManager({} as any, '/tmp', { info() {}, warn() {}, error() {}, debug() {} } as any);
    (manager as any).registry = {
      instantiate: async () => ({ instance: { id: resolvedByTenant.get(RequestContextUtils.getTenantId()) } }),
    };
    return manager;
  }

  static async asTenant<T>(tenantId: string | undefined, run: () => Promise<T>): Promise<T> {
    if (!tenantId) return run();
    return RequestContextUtils.storage.run({ tenantId } as any, run);
  }
}

describe('IntegrationManager instance cache', () => {
  it('gives each tenant its own resolved instance instead of the first one resolved', async () => {
    const manager = TenantCacheFixture.manager(new Map([
      [undefined, 'platform'],
      ['tenant-a', 'a'],
      ['tenant-b', 'b'],
    ]));

    // The untenanted boot resolves first, exactly as it does on a real start-up.
    expect((await TenantCacheFixture.asTenant(undefined, () => manager.get('shipping_provider'))).id).toBe('platform');
    expect((await TenantCacheFixture.asTenant('tenant-a', () => manager.get('shipping_provider'))).id).toBe('a');
    expect((await TenantCacheFixture.asTenant('tenant-b', () => manager.get('shipping_provider'))).id).toBe('b');
  });

  it('serves a tenant its own cached instance on the second call', async () => {
    let resolves = 0;
    const manager = new IntegrationManager({} as any, '/tmp', { info() {}, warn() {}, error() {}, debug() {} } as any);
    (manager as any).registry = { instantiate: async () => { resolves += 1; return { instance: { id: resolves } }; } };

    await TenantCacheFixture.asTenant('tenant-a', () => manager.get('shipping_provider'));
    await TenantCacheFixture.asTenant('tenant-a', () => manager.get('shipping_provider'));
    expect(resolves).toBe(1);

    await TenantCacheFixture.asTenant('tenant-b', () => manager.get('shipping_provider'));
    expect(resolves).toBe(2);
  });
});

describe('IntegrationManager after a configuration write', () => {
  it('re-reads a site\'s integration once that site saves new settings', async () => {
    let version = 1;
    const manager = new IntegrationManager({} as any, '/tmp', { info() {}, warn() {}, error() {}, debug() {} } as any);
    (manager as any).registry = { instantiate: async () => ({ instance: { version } }) };

    expect((await TenantCacheFixture.asTenant('tenant-a', () => manager.get('shipping_provider'))).version).toBe(1);
    version = 2;
    await TenantCacheFixture.asTenant('tenant-a', () => (manager as any).refreshType('shipping_provider'));
    expect((await TenantCacheFixture.asTenant('tenant-a', () => manager.get('shipping_provider'))).version).toBe(2);
  });

  it('drops the email driver a site resolved before it had mail settings', async () => {
    const manager = new IntegrationManager({} as any, '/tmp', { info() {}, warn() {}, error() {}, debug() {} } as any);
    const instances: Map<string, unknown> = (manager as any).instances;
    (manager as any).refreshEmail = async () => ({});
    instances.set('tenant-a::email', { stale: true });
    instances.set('tenant-b::email', { other: true });

    await TenantCacheFixture.asTenant('tenant-a', () => (manager as any).refreshType('email'));

    expect(instances.has('tenant-a::email')).toBe(false);
    // Another site's driver is not this write's business.
    expect(instances.has('tenant-b::email')).toBe(true);
  });

  it('drops every site\'s email driver when the platform\'s own mail settings change', async () => {
    const manager = new IntegrationManager({} as any, '/tmp', { info() {}, warn() {}, error() {}, debug() {} } as any);
    const instances: Map<string, unknown> = (manager as any).instances;
    (manager as any).refreshEmail = async () => ({});
    instances.set('tenant-a::email', { platformFallback: true });
    instances.set('tenant-b::storage', { untouched: true });

    await TenantCacheFixture.asTenant(undefined, () => (manager as any).refreshType('email'));

    expect(instances.has('tenant-a::email')).toBe(false);
    expect(instances.has('tenant-b::storage')).toBe(true);
  });
});
