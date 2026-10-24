import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminConsoleBrand } from '@/lib/admin-console-brand';

/**
 * The name and icon a site's console wears in its page head, read on the server from the api's
 * public host route — so the first paint is already the site's, not the platform's.
 */
describe('AdminConsoleBrand', () => {
  const reset = () => (AdminConsoleBrand as any).cache.clear();
  beforeEach(reset);
  afterEach(() => { vi.unstubAllGlobals(); reset(); });

  const answering = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body })) as never;

  it('reads the brand of the appearance the host wears', async () => {
    vi.stubGlobal('fetch', answering({ workspace: { brand: { name: 'Replybird', icon: '/appearances/replybird/ui/mark.png' } } }));

    expect(await AdminConsoleBrand.forHost('replybird.example.com'))
      .toEqual({ name: 'Replybird', icon: '/appearances/replybird/ui/mark.png' });
  });

  it('forwards the host and names the admin client — a console at a path is only answered for it', async () => {
    const fetcher = answering({ workspace: null });
    vi.stubGlobal('fetch', fetcher);
    process.env.API_URL = 'http://api:3000';

    await AdminConsoleBrand.forHost('Replybird.Example.com');

    expect(fetcher).toHaveBeenCalledWith('http://api:3000/api/auth/host', expect.objectContaining({
      headers: { accept: 'application/json', 'x-forwarded-host': 'replybird.example.com', 'x-framework-client': 'admin-ui' },
      signal: expect.any(AbortSignal),
    }));
  });

  it.each([
    ['no workspace', { workspace: null }],
    ['the built-in console', { workspace: { brand: null } }],
    ['a brand with no name', { workspace: { brand: { name: ' ', icon: '/x.png' } } }],
  ])('keeps the platform identity for %s', async (_label, body) => {
    vi.stubGlobal('fetch', answering(body));

    expect(await AdminConsoleBrand.forHost('a.example.com')).toBeNull();
  });

  it('keeps the platform identity when the api cannot be reached or refuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }) as never);
    expect(await AdminConsoleBrand.forHost('a.example.com')).toBeNull();

    reset();
    vi.stubGlobal('fetch', answering({}, false));
    expect(await AdminConsoleBrand.forHost('a.example.com')).toBeNull();
  });

  it('asks once a minute per host, not on every page', async () => {
    const fetcher = answering({ workspace: { brand: { name: 'A', icon: '' } } });
    vi.stubGlobal('fetch', fetcher);

    await AdminConsoleBrand.forHost('a.example.com');
    await AdminConsoleBrand.forHost('a.example.com');
    await AdminConsoleBrand.forHost('b.example.com');

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
