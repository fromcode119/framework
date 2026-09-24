import { describe, expect, it } from 'vitest';
import { LoginTenantChoice } from '@api/controllers/auth/login-tenant-choice';

describe('the site a login enters', () => {
  it("enters the storefront's site for an account in several sites", () => {
    expect(LoginTenantChoice.choose({ storefrontId: 'vselenskiportal', availableIds: ['vselenskiportal', 'fromcode', 'tagiqx-app'] })).toBe('vselenskiportal');
  });

  it('keeps the old rules on a storefront the account does not belong to', () => {
    expect(LoginTenantChoice.choose({ storefrontId: 'shop', availableIds: ['other'] })).toBe('other');
    expect(LoginTenantChoice.choose({ storefrontId: 'shop', availableIds: ['a', 'b'] })).toBeUndefined();
  });

  it('lets a workspace host name its site first, and a single site select itself', () => {
    expect(LoginTenantChoice.choose({ workspaceId: 'hub', storefrontId: 'shop', availableIds: ['shop', 'hub'] })).toBe('hub');
    expect(LoginTenantChoice.choose({ availableIds: ['only'] })).toBe('only');
    expect(LoginTenantChoice.choose({ availableIds: ['a', 'b'] })).toBeUndefined();
  });
});
