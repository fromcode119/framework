import { describe, expect, it } from 'vitest';
import { ClientLayoutSiteStateHooks } from '@/app/services/client-layout-site-state-hooks';

const site = { id: 't1', slug: 'the-pink-shop', primaryHost: 'shop.example', platformAccess: true, kind: 'site', appearance: '' };

/** A one-site install whose session sat outside its site showed no plugin pages in the menu. */
describe('ClientLayoutSiteStateHooks.onlySiteToEnter', () => {
  it('enters the only site of a session that is outside it', () => {
    expect(ClientLayoutSiteStateHooks.onlySiteToEnter({ multiTenant: true, current: null, tenants: [site] })).toBe('t1');
  });

  it('leaves alone a session that stepped out to the platform on purpose', () => {
    expect(ClientLayoutSiteStateHooks.onlySiteToEnter({ multiTenant: true, current: null, platformChosen: true, tenants: [site] })).toBe('');
  });

  it('does nothing with two sites, inside a site, on a workspace host or without tenancy', () => {
    expect(ClientLayoutSiteStateHooks.onlySiteToEnter({ multiTenant: true, current: null, tenants: [site, { ...site, id: 't2' }] })).toBe('');
    expect(ClientLayoutSiteStateHooks.onlySiteToEnter({ multiTenant: true, current: 't1', tenants: [site] })).toBe('');
    expect(ClientLayoutSiteStateHooks.onlySiteToEnter({ multiTenant: true, current: null, locked: true, tenants: [site] })).toBe('');
    expect(ClientLayoutSiteStateHooks.onlySiteToEnter({ multiTenant: false, tenants: [] })).toBe('');
  });
});
