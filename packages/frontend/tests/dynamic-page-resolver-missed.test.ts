import { headers } from 'next/headers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { ServerApiUtils } from '@/lib/server-api/server-api';
import { ServerFetchOutcome } from '@/lib/server-fetch-outcome';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

/**
 * The redirect lookup is the storefront's last one before a 404, so it is the one that tells the API a
 * visitor missed (`missed=1`), carrying the VISITOR's referrer and browser — without them the 404 log
 * records the storefront server's own fetch (`node`, no referrer).
 */
describe('DynamicPageResolver.resolveRedirect', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks the lookup as the miss and forwards the visitor referrer and user agent', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({
      referer: 'https://example.test/from',
      'user-agent': 'Mozilla/5.0 Visitor',
    }) as never);
    const fetch = vi.spyOn(ServerApiUtils, 'serverFetchResponseOutcome')
      .mockResolvedValue(ServerFetchOutcome.resolved<Response>(new Response('{}', { status: 404 })));

    await expect(DynamicPageResolver.resolveRedirect('/gone/page')).resolves.toBeNull();

    const [path, init] = fetch.mock.calls[0];
    expect(path).toContain('slug=gone%2Fpage');
    expect(path).toContain('missed=1');
    expect(init?.headers).toEqual({ referer: 'https://example.test/from', 'user-agent': 'Mozilla/5.0 Visitor' });
  });

  it('returns the redirect the API answered with', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers() as never);
    vi.spyOn(ServerApiUtils, 'serverFetchResponseOutcome').mockResolvedValue(ServerFetchOutcome.resolved<Response>(
      new Response(JSON.stringify({ type: 'redirect', redirect: { target: '/new', permanent: false } }), { status: 200 }),
    ));

    await expect(DynamicPageResolver.resolveRedirect('/moved')).resolves.toEqual({ target: '/new', permanent: false });
  });
});
