import { headers } from 'next/headers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { LocaleUrlStrategy } from '@fromcode119/core/client';
import { ServerApiUtils } from '@/lib/server-api/server-api';
import { ServerFetchOutcome } from '@/lib/server-fetch-outcome';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

/**
 * A path that resolves to nothing used to cost three full resolutions: the slug, the same slug with a
 * leading slash (the API normalizes both to one path), and a third lookup only to report the miss and
 * read the redirect rule — which the first lookup had already answered.
 */
describe('a storefront miss asks the API once', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports the miss and reads the redirect from the one lookup', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ 'user-agent': 'Visitor' }) as never);
    const fetch = vi.spyOn(ServerApiUtils, 'serverFetchResponseOutcome')
      .mockResolvedValue(ServerFetchOutcome.resolved<Response>(new Response('{}', { status: 404 })));

    const resolution = await DynamicPageResolver.resolveDocWithPermalinkFallbackResult('no-such-page', {}, 'bg', LocaleUrlStrategy.QUERY, true);
    expect(await DynamicPageResolver.redirectAfterMiss('no-such-page', resolution)).toBeNull();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain('missed=1');
  });

  it('returns the redirect rule the lookup matched', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers() as never);
    const fetch = vi.spyOn(ServerApiUtils, 'serverFetchResponseOutcome').mockResolvedValue(ServerFetchOutcome.resolved<Response>(
      new Response(JSON.stringify({ type: 'redirect', redirect: { target: '/new', permanent: true } }), { status: 200 }),
    ));

    const resolution = await DynamicPageResolver.resolveDocWithPermalinkFallbackResult('old-page', {}, 'bg', LocaleUrlStrategy.QUERY, true);
    expect(await DynamicPageResolver.redirectAfterMiss('old-page', resolution)).toEqual({ target: '/new', permanent: true, gone: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
