import { describe, expect, it } from 'vitest';
import { TenantIdentity } from '@core/tenant/provisioning/tenant-identity';
import { TenantRecord } from '@core/tenant/tenant-record';
import { TenantVisibility } from '@core/enums/tenant-visibility.enum';

/**
 * Whether a site is open to the public — the axis `state` could not carry.
 *
 * Suspending a site takes its ADMIN away too (the api answers 503 on the admin branch), so it could
 * never mean "still being built": the one control that hid a site also locked the operator out of
 * finishing it. These tests pin the two axes apart and pin the default closed.
 */
describe('Site visibility', () => {
  const row = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'acme', slug: 'acme', primary_host: 'acme.test', host_aliases: '[]',
    state: 'active', kind: 'site', appearance: '', ...overrides,
  });

  it('a new site is PRIVATE unless it says otherwise', () => {
    const identity = TenantIdentity.from({ slug: 'acme', primaryHost: 'acme.test', kind: 'site' });

    expect(identity.visibility).toBe(TenantVisibility.PRIVATE);
  });

  it('takes the visibility it is given', () => {
    const identity = TenantIdentity.from({ slug: 'acme', primaryHost: 'acme.test', kind: 'site', visibility: 'public' });

    expect(identity.visibility).toBe(TenantVisibility.PUBLIC);
  });

  it('refuses to read an unknown value as open — it falls to private', () => {
    const identity = TenantIdentity.from({ slug: 'acme', primaryHost: 'acme.test', kind: 'site', visibility: 'live' });

    expect(identity.visibility).toBe(TenantVisibility.PRIVATE);
  });

  it.each([
    ['private', false, false],
    ['unlisted', true, false],
    ['public', true, true],
  ])('%s: readable=%s indexable=%s', (visibility, readable, indexable) => {
    const tenant = TenantRecord.from(row({ visibility }));

    expect(tenant.isReadable).toBe(readable);
    expect(tenant.isIndexable).toBe(indexable);
  });

  it('a row written before the column existed reads as private, not public', () => {
    expect(TenantRecord.from(row()).visibility).toBe(TenantVisibility.PRIVATE);
  });

  it('SUSPENSION outranks visibility: a suspended public site is neither readable nor indexable', () => {
    const tenant = TenantRecord.from(row({ state: 'suspended', visibility: 'public' }));

    expect(tenant.isActive).toBe(false);
    expect(tenant.isReadable).toBe(false);
    expect(tenant.isIndexable).toBe(false);
  });

  it('but a suspended site KEEPS its visibility, for when it is reactivated', () => {
    expect(TenantRecord.from(row({ state: 'suspended', visibility: 'public' })).visibility)
      .toBe(TenantVisibility.PUBLIC);
  });
});
