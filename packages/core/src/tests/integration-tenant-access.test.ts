import { afterEach, describe, expect, it } from 'vitest';
import { IntegrationTenantAccess } from '@core/integrations/integration-tenant-access';
import { TenantScopedIntegration } from '@core/integrations/tenant-scoped-integration';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * Only `email` used to be tenant-routed. `storage`, `cache` and `queue` were assigned the platform
 * instance straight to the field, so every site shared one media manager, one cache and one queue —
 * for storage that is uploads and deletes, not merely URLs.
 */
class FakeStorage {
  constructor(private readonly base: string) {}
  publicUrl(path: string): string { return `${this.base}/${path}`; }
  async remove(path: string): Promise<string> { return `${this.base}:removed:${path}`; }
}

const inTenant = <T>(tenantId: string, fn: () => T): T =>
  RequestContextUtils.storage.run({ locale: 'en', tenantId } as never, fn);

afterEach(() => IntegrationTenantAccess.reset());

describe('IntegrationTenantAccess', () => {
  it('warms a site once and answers synchronously afterwards', async () => {
    let resolves = 0;
    IntegrationTenantAccess.configure(async (tenantId) => { resolves += 1; return new FakeStorage(tenantId); });
    await IntegrationTenantAccess.warm('acme');
    await IntegrationTenantAccess.warm('acme');
    expect(resolves).toBe(IntegrationTenantAccess.WARMED_TYPES.length);
    const found = inTenant('acme', () => IntegrationTenantAccess.forCurrentTenant<FakeStorage>('storage'));
    expect(found?.publicUrl('a.png')).toBe('acme/a.png');
  });

  it('answers undefined with no tenant bound, which is what framework work needs', () => {
    IntegrationTenantAccess.configure(async (t) => new FakeStorage(t));
    expect(IntegrationTenantAccess.forCurrentTenant('storage')).toBeUndefined();
  });

  it('does not cache a failed resolve — one bad read must not look permanent', async () => {
    let attempts = 0;
    IntegrationTenantAccess.configure(async (tenantId, type) => {
      attempts += 1;
      if (attempts === 1 && type === 'storage') throw new Error('transient');
      return new FakeStorage(tenantId);
    });
    await IntegrationTenantAccess.warm('acme');
    await IntegrationTenantAccess.warm('acme');
    expect(inTenant('acme', () => IntegrationTenantAccess.forCurrentTenant<FakeStorage>('storage'))).toBeDefined();
  });

  it('invalidate drops only that site', async () => {
    IntegrationTenantAccess.configure(async (t) => new FakeStorage(t));
    await IntegrationTenantAccess.warm('acme');
    await IntegrationTenantAccess.warm('globex');
    IntegrationTenantAccess.invalidate('acme');
    expect(inTenant('acme', () => IntegrationTenantAccess.forCurrentTenant('storage'))).toBeUndefined();
    expect(inTenant('globex', () => IntegrationTenantAccess.forCurrentTenant('storage'))).toBeDefined();
  });
});

describe('TenantScopedIntegration synchronous methods', () => {
  it('keeps a named sync method synchronous and routes it to the warmed site', async () => {
    IntegrationTenantAccess.configure(async (t) => new FakeStorage(t));
    await IntegrationTenantAccess.warm('acme');
    const wrapped = TenantScopedIntegration.wrap<FakeStorage>(
      () => new FakeStorage('platform'),
      async () => new FakeStorage('async-path'),
      ['publicUrl'],
      () => IntegrationTenantAccess.forCurrentTenant<FakeStorage>('storage'),
    );
    const url = inTenant('acme', () => wrapped.publicUrl('a.png'));
    // A string, NOT a promise: a promise here renders as "[object Promise]" in a page.
    expect(typeof url).toBe('string');
    expect(url).toBe('acme/a.png');
  });

  it('falls back to the platform for a sync method when nothing is bound', () => {
    IntegrationTenantAccess.configure(async (t) => new FakeStorage(t));
    const wrapped = TenantScopedIntegration.wrap<FakeStorage>(
      () => new FakeStorage('platform'),
      async () => new FakeStorage('async-path'),
      ['publicUrl'],
      () => IntegrationTenantAccess.forCurrentTenant<FakeStorage>('storage'),
    );
    expect(wrapped.publicUrl('a.png')).toBe('platform/a.png');
  });

  it('still routes async methods through the awaited per-tenant lookup', async () => {
    const wrapped = TenantScopedIntegration.wrap<FakeStorage>(
      () => new FakeStorage('platform'),
      async (tenantId) => new FakeStorage(tenantId),
    );
    expect(await inTenant('globex', () => wrapped.remove('a.png'))).toBe('globex:removed:a.png');
  });
});
