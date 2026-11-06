import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/frontend-config-cache', () => ({ FrontendConfigCache: { read: async () => ({ contentRevision: 'r1' }) } }));

const { DynamicPageResolver } = await import('@/lib/dynamic-page-resolver');
const { LocaleUrlStrategy } = await import('@fromcode119/core/client');
const { ServerApiUtils } = await import('@/lib/server-api/server-api');
const { ServerFetchOutcome } = await import('@/lib/server-fetch-outcome');
const { RequestScope } = await import('@/lib/request-scope');
const { SiteRevisionMemo } = await import('@/lib/site-revision-memo');

/**
 * A framework page (/login) has no content document. It used to be resolved as a reported miss on every
 * visit — a 404 log entry per sign-in view, a moved content revision, an empty page cache.
 */
describe('a path no visitor miss is reported for', () => {
  beforeEach(() => SiteRevisionMemo.reset());
  afterEach(() => vi.restoreAllMocks());

  const anonymous = <T>(work: () => Promise<T>) => RequestScope.run(work, { shareKey: 'https://shop' });

  it('asks without missed=1 and serves the next anonymous visitor from the first answer', async () => {
    const fetch = vi.spyOn(ServerApiUtils, 'serverFetchResponseOutcome')
      .mockImplementation(async () => ServerFetchOutcome.resolved<Response>(new Response('{}', { status: 404 })));
    for (let i = 0; i < 3; i += 1) {
      await anonymous(() => DynamicPageResolver.resolveDocWithPermalinkFallbackResult('login', {}, 'bg', LocaleUrlStrategy.QUERY, false));
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).not.toContain('missed=1');
  });

  it('never keeps a failed answer', async () => {
    const fetch = vi.spyOn(ServerApiUtils, 'serverFetchResponseOutcome')
      .mockImplementation(async () => ServerFetchOutcome.resolved<Response>(new Response('{}', { status: 500 })));
    await anonymous(() => DynamicPageResolver.resolveDocWithPermalinkFallbackResult('login', {}, 'bg', LocaleUrlStrategy.QUERY, false));
    await anonymous(() => DynamicPageResolver.resolveDocWithPermalinkFallbackResult('login', {}, 'bg', LocaleUrlStrategy.QUERY, false));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('still reports every real miss', async () => {
    const fetch = vi.spyOn(ServerApiUtils, 'serverFetchResponseOutcome')
      .mockImplementation(async () => ServerFetchOutcome.resolved<Response>(new Response('{}', { status: 404 })));
    await anonymous(() => DynamicPageResolver.resolveDocWithPermalinkFallbackResult('nope', {}, 'bg', LocaleUrlStrategy.QUERY, true));
    await anonymous(() => DynamicPageResolver.resolveDocWithPermalinkFallbackResult('nope', {}, 'bg', LocaleUrlStrategy.QUERY, true));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.every((call) => String(call[0]).includes('missed=1'))).toBe(true);
  });
});
