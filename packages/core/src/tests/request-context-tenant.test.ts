import { describe, expect, it } from 'vitest';
import { RequestContextUtils } from '@core/context/request-context';

describe('RequestContextUtils tenant', () => {
  it('returns the tenant id inside a request scope', () => {
    RequestContextUtils.storage.run({ locale: 'en', tenantId: 't1' }, () => {
      expect(RequestContextUtils.getTenantId()).toBe('t1');
      expect(RequestContextUtils.requireTenantId()).toBe('t1');
    });
  });

  it('returns undefined outside a request scope', () => {
    expect(RequestContextUtils.getTenantId()).toBeUndefined();
  });

  it('requireTenantId THROWS rather than defaulting — absent must never mean all tenants', () => {
    expect(() => RequestContextUtils.requireTenantId()).toThrow(/tenant/i);
    RequestContextUtils.storage.run({ locale: 'en' }, () => {
      expect(() => RequestContextUtils.requireTenantId()).toThrow(/tenant/i);
    });
  });

  it('treats an empty tenant id as absent', () => {
    RequestContextUtils.storage.run({ locale: 'en', tenantId: '' }, () => {
      expect(RequestContextUtils.getTenantId()).toBeUndefined();
      expect(() => RequestContextUtils.requireTenantId()).toThrow(/tenant/i);
    });
  });

  it('does not leak a tenant between sibling scopes', () => {
    RequestContextUtils.storage.run({ locale: 'en', tenantId: 'a' }, () => {
      RequestContextUtils.storage.run({ locale: 'en', tenantId: 'b' }, () => {
        expect(RequestContextUtils.getTenantId()).toBe('b');
      });
      expect(RequestContextUtils.getTenantId()).toBe('a');
    });
  });
});
