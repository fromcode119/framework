import { afterEach, describe, expect, it } from 'vitest';
import { CookieConstants, TenantMode } from '@fromcode119/core';
import { RealtimeSocketAuthorizer } from '@api/server/realtime-socket-authorizer';

/**
 * The live socket carries every write of a site, whole rows included: only that site's administrator
 * may open it. Before, any connection was accepted with no credentials at all.
 */
describe('who may open the live socket', () => {
  afterEach(() => TenantMode.reset());

  const claims: Record<string, Record<string, unknown>> = {
    'site-admin': { id: 1, roles: ['admin'], tenantId: 'alpha', iat: 10 },
    'site-admin-newer': { id: 1, roles: ['admin'], tenantId: 'beta', iat: 20 },
    customer: { id: 2, roles: ['customer'], tenantId: 'alpha', iat: 10 },
    'no-site': { id: 3, roles: ['admin'], iat: 10 },
  };
  const rooms: Record<string, { tenantId: string | null; room: string }> = {
    'chat-token': { tenantId: 'alpha', room: 'helpdesk:conversation-1' },
  };
  const authorizer = new RealtimeSocketAuthorizer({
    verifyToken: async (token: string) => {
      if (!claims[token]) throw new Error('invalid');
      return claims[token];
    },
  }, {
    verify: async (token: string) => rooms[token] ?? null,
  });
  const upgrade = (cookie?: string) => ({ headers: cookie ? { cookie } : {} }) as any;
  const at = (query = '') => new URL(`http://api.test/api/v1/socket${query}`);
  const sites = () => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });

  it('refuses a connection with no session, a forged one, or a customer\'s', async () => {
    sites();
    expect(await authorizer.authorize(upgrade(), at())).toBeNull();
    expect(await authorizer.authorize(upgrade(`${CookieConstants.AUTH_TOKEN}=forged`), at())).toBeNull();
    expect(await authorizer.authorize(upgrade(`${CookieConstants.AUTH_TOKEN}=customer`), at())).toBeNull();
  });

  it('binds an administrator to the site of the session, the newest session winning', async () => {
    sites();
    expect(await authorizer.authorize(upgrade(`${CookieConstants.AUTH_TOKEN}=site-admin`), at())).toEqual({ tenantId: 'alpha' });
    expect(await authorizer.authorize(upgrade(`${CookieConstants.AUTH_TOKEN}=site-admin; ${CookieConstants.AUTH_TOKEN}=site-admin-newer`), at())).toEqual({ tenantId: 'beta' });
  });

  it('refuses an administrator session that names no site where there are sites, and admits it where there are none', async () => {
    sites();
    expect(await authorizer.authorize(upgrade(`${CookieConstants.AUTH_TOKEN}=no-site`), at())).toBeNull();
    TenantMode.reset();
    expect(await authorizer.authorize(upgrade(`${CookieConstants.AUTH_TOKEN}=no-site`), at())).toEqual({ tenantId: null });
  });

  it('admits a room token to its room alone, and never falls back to the session beside a bad one', async () => {
    sites();
    expect(await authorizer.authorize(upgrade(), at('?room=chat-token'))).toEqual({ tenantId: 'alpha', room: 'helpdesk:conversation-1' });
    expect(await authorizer.authorize(upgrade(), at('?room=forged'))).toBeNull();
    expect(await authorizer.authorize(upgrade(`${CookieConstants.AUTH_TOKEN}=site-admin`), at('?room=forged'))).toBeNull();
    expect(await authorizer.authorize(upgrade(`${CookieConstants.AUTH_TOKEN}=site-admin`), at('?room='))).toBeNull();
  });
});
