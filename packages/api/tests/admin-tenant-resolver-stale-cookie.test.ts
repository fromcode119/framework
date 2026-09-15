import { describe, expect, it, vi } from 'vitest';
import { AdminTenantResolver } from '@api/services/request/admin-tenant-resolver';

/**
 * A browser can hold two session cookies of the same name at once — one host-scoped, one written to
 * the apex before admin sessions were narrowed to the host — and it sends BOTH. RFC 6265 orders them
 * by path length and then by AGE, so the STALE one arrives first.
 *
 * Reading "the first" therefore read the dead session on every request, which is what made switching
 * site look like it silently did nothing: the switch really did mint a token carrying the new tenant
 * and really did write the session row, but the next request went on presenting the old cookie, whose
 * claim has no tenant. Nothing errored — a stale token is perfectly valid, it just belongs to no site.
 */
describe('a stale session cookie must not shadow the new one', () => {
  const STALE = 'stale.token.value';
  const FRESH = 'fresh.token.value';

  const resolver = (claims: Record<string, any>) => {
    const auth: any = {
      verifyToken: vi.fn(async (token: string) => {
        if (!claims[token]) throw new Error('invalid token');
        return claims[token];
      }),
    };
    const tenants: any = { resolveById: async (id: string) => ({ id, slug: id, isActive: true }) };
    const memberships: any = { hasAccess: async () => true };
    const workspaceHosts: any = { resolve: async () => null };
    return new AdminTenantResolver(auth, tenants, memberships, workspaceHosts);
  };

  /** The browser sends the older cookie FIRST — this is the ordering that caused the bug. */
  const request = (header: string) => ({ headers: { cookie: header }, cookies: {} }) as any;

  it('uses the newest session when two arrive, stale one first', async () => {
    const result = await resolver({
      [STALE]: { id: '1', iat: 1000 },
      [FRESH]: { id: '1', iat: 2000, tenantId: 'somesite' },
    }).resolve(request(`fc_token=${STALE}; fc_token=${FRESH}`));

    expect(result.reason).toBeUndefined();
    expect(result.tenant?.id).toBe('somesite');
  });

  it('is not fooled by the order they happen to arrive in', async () => {
    const result = await resolver({
      [STALE]: { id: '1', iat: 1000 },
      [FRESH]: { id: '1', iat: 2000, tenantId: 'somesite' },
    }).resolve(request(`fc_token=${FRESH}; fc_token=${STALE}`));

    expect(result.tenant?.id).toBe('somesite');
  });

  it('a rotten cookie beside a good one does not deny the good one', async () => {
    // An expired or forged value must not be able to sign somebody out by sitting next to a valid one.
    const result = await resolver({ [FRESH]: { id: '1', iat: 2000, tenantId: 'somesite' } })
      .resolve(request(`fc_token=garbage; fc_token=${FRESH}`));

    expect(result.tenant?.id).toBe('somesite');
  });

  it('still refuses when nothing valid is presented', async () => {
    const result = await resolver({}).resolve(request('fc_token=garbage'));

    expect(result.tenant).toBeNull();
    expect(String(result.reason)).toBe('unauthenticated');
  });

  it('reads the parsed cookie too, for the paths that run after cookie-parser', async () => {
    const req: any = { headers: {}, cookies: { fc_token: FRESH } };
    const result = await resolver({ [FRESH]: { id: '1', iat: 2000, tenantId: 'somesite' } }).resolve(req);

    expect(result.tenant?.id).toBe('somesite');
  });
});
