import { afterEach, describe, expect, it } from 'vitest';
import { TenantMode } from '@core/tenant/tenant-mode';

describe('TenantMode', () => {
  afterEach(() => TenantMode.reset());

  it('is disabled when no tenants are configured', () => {
    TenantMode.configure({ tenantCount: 0, dialect: 'postgres', isolationSupported: true });
    expect(TenantMode.isEnabled()).toBe(false);
  });

  it('is enabled once tenants exist', () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    expect(TenantMode.isEnabled()).toBe(true);
  });

  it('REFUSES a multi-tenant deployment on a driver with no isolation strategy', () => {
    // The failure this exists to prevent: several customers in one database with nothing separating
    // them, looking healthy until one reads another's rows.
    expect(() => TenantMode.configure({ tenantCount: 2, dialect: 'mysql', isolationSupported: false }))
      .toThrow(/no tenant isolation strategy/i);
  });

  it('names the offending driver in the refusal', () => {
    expect(() => TenantMode.configure({ tenantCount: 1, dialect: 'mysql', isolationSupported: false }))
      .toThrow(/mysql/i);
  });

  it('allows a SINGLE-tenant deployment on a driver with no isolation strategy', () => {
    // Every existing installation is in this state. There is nothing to isolate, so demanding an
    // isolation strategy here would break every deployment that has not been migrated.
    expect(() => TenantMode.configure({ tenantCount: 0, dialect: 'sqlite', isolationSupported: false }))
      .not.toThrow();
    expect(TenantMode.isEnabled()).toBe(false);
  });

  it('is disabled before configure() has ever run', () => {
    expect(TenantMode.isEnabled()).toBe(false);
  });
});
