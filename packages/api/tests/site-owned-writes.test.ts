import { afterEach, describe, expect, it } from 'vitest';
import { TenantMode } from '@fromcode119/core';
import { SiteOwnedWrites } from '@api/services/system/site-owned-writes';

/** Media and people need a chosen site only on a multi-site installation. */
describe('SiteOwnedWrites', () => {
  afterEach(() => TenantMode.reset());

  it('allows a write in a bound site', () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    expect(SiteOwnedWrites.possible({ tenantId: 'demo' })).toBe(true);
  });

  it('refuses in the platform scope of a multi-site installation', () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    expect(SiteOwnedWrites.possible({})).toBe(false);
  });

  it('allows a single-site installation on a database that could keep sites apart', () => {
    TenantMode.configure({ tenantCount: 0, dialect: 'postgres', isolationSupported: true });
    expect(SiteOwnedWrites.possible({})).toBe(true);
  });

  it('allows a single-site database that keeps no owner on records', () => {
    TenantMode.configure({ tenantCount: 0, dialect: 'sqlite', isolationSupported: false });
    expect(SiteOwnedWrites.possible({})).toBe(true);
  });
});
