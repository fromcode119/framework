import { describe, expect, it } from 'vitest';
import { LoginTenantChoice } from '@api/controllers/auth/login-tenant-choice';

describe('the site a login enters', () => {
  it("enters the storefront's site for a customer who administers nothing", () => {
    expect(LoginTenantChoice.choose({ storefrontId: 'shop', mayEnterStorefront: true, administeredIds: [] })).toBe('shop');
  });

  it("enters the storefront's site for an account that administers other sites", () => {
    expect(LoginTenantChoice.choose({ storefrontId: 'shop', mayEnterStorefront: true, administeredIds: ['agency', 'other-shop'] })).toBe('shop');
  });

  it('keeps the old rules on a storefront the account may not enter', () => {
    expect(LoginTenantChoice.choose({ storefrontId: 'shop', mayEnterStorefront: false, administeredIds: ['other'] })).toBe('other');
    expect(LoginTenantChoice.choose({ storefrontId: 'shop', mayEnterStorefront: false, administeredIds: [] })).toBeUndefined();
  });

  it('lets a workspace host name its site first, and a single administered site select itself', () => {
    expect(LoginTenantChoice.choose({ workspaceId: 'hub', storefrontId: 'shop', mayEnterStorefront: true, administeredIds: [] })).toBe('hub');
    expect(LoginTenantChoice.choose({ mayEnterStorefront: false, administeredIds: ['only'] })).toBe('only');
    expect(LoginTenantChoice.choose({ mayEnterStorefront: false, administeredIds: ['a', 'b'] })).toBeUndefined();
  });
});
