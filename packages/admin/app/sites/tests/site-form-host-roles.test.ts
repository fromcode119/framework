import { describe, expect, it } from 'vitest';
import { SiteFormValues } from '@/app/sites/site-form-values';

/**
 * What the host-role control actually SAVES.
 *
 * The control itself is three lines — pick a role, hand the map up, render what came back. The part
 * worth pinning is the chain between the click and the request: `with()` has to carry the map,
 * `toUpdatePayload()` has to send it, and a role has to stop existing when its host does.
 *
 * That last rule is the one that bites. A role left behind by a removed host would sit in the row
 * describing nothing, and would spring back to life the day somebody re-used that name — a setting
 * nobody chose, which is the whole class of problem this field exists to end.
 */
describe('SiteFormValues — saving what each host serves', () => {
  const site = (): SiteFormValues => SiteFormValues.empty().with({
    slug: 'shop',
    id: 'shop',
    primaryHost: 'shop.example.com',
    hostAliases: 'api.shop.example.com, backend.shop.example.com',
  });

  it('carries a chosen role through to the update payload', () => {
    const values = site().with({ hostRoles: { 'backend.shop.example.com': 'admin' } });

    expect(values.toUpdatePayload().hostRoles).toEqual({ 'backend.shop.example.com': 'admin' });
  });

  it('sends an empty map when nothing has been chosen, not undefined', () => {
    // An absent field means UNCHANGED on the server, so a site whose last role was just cleared
    // would keep it for ever. Clearing has to be expressible.
    expect(site().toUpdatePayload().hostRoles).toEqual({});
  });

  it('drops a role whose host has been removed from the form', () => {
    const values = site()
      .with({ hostRoles: { 'backend.shop.example.com': 'admin' } })
      .with({ hostAliases: 'api.shop.example.com' });

    expect(values.toUpdatePayload().hostRoles).toEqual({});
  });

  it('keeps a role on the primary host', () => {
    const values = site().with({ hostRoles: { 'shop.example.com': 'api' } });

    expect(values.toUpdatePayload().hostRoles).toEqual({ 'shop.example.com': 'api' });
  });

  it('matches hosts case-insensitively, so a typed capital does not lose the role', () => {
    const values = site()
      .with({ primaryHost: 'Shop.Example.com' })
      .with({ hostRoles: { 'shop.example.com': 'api' } });

    expect(values.toUpdatePayload().hostRoles).toEqual({ 'shop.example.com': 'api' });
  });

  it('keeps several roles at once', () => {
    const values = site().with({
      hostRoles: { 'backend.shop.example.com': 'admin', 'api.shop.example.com': 'api' },
    });

    expect(values.toUpdatePayload().hostRoles).toEqual({
      'backend.shop.example.com': 'admin',
      'api.shop.example.com': 'api',
    });
  });

  /** Choosing the default removes the entry rather than storing the default — see SiteHostRoles. */
  it('an absent entry is how "the default" is expressed', () => {
    const values = site().with({ hostRoles: { 'backend.shop.example.com': 'admin' } });
    const cleared = values.with({ hostRoles: {} });

    expect(cleared.toUpdatePayload().hostRoles).toEqual({});
  });

  it('leaves the rest of the payload alone', () => {
    const payload = site().with({ hostRoles: { 'api.shop.example.com': 'api' } }).toUpdatePayload();

    expect(payload.primaryHost).toBe('shop.example.com');
    expect(payload.hostAliases).toEqual(['api.shop.example.com', 'backend.shop.example.com']);
  });
});
