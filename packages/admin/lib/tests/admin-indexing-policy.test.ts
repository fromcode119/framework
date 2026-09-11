import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminIndexingPolicy } from '@/lib/admin-indexing-policy';

/**
 * Whether crawlers may index the console.
 *
 * The default matters more than the feature: the admin said nothing to a crawler at all — no
 * robots.txt, no `X-Robots-Tag`, no meta — so it was indexable by omission. Every path that cannot
 * get a clear "yes" must answer no, because a console that reaches a search index is not something
 * a later correction takes back.
 */
describe('AdminIndexingPolicy', () => {
  const reset = () => {
    (AdminIndexingPolicy as any).cachedAt = 0;
    (AdminIndexingPolicy as any).cached = false;
  };

  beforeEach(reset);
  afterEach(() => { vi.unstubAllGlobals(); reset(); });

  const answering = (body: unknown, ok = true) => vi.fn(async () => ({
    ok, json: async () => body,
  })) as never;

  it('refuses by default — an installation that has never set it is not indexed', async () => {
    vi.stubGlobal('fetch', answering({ multiTenant: false }));

    expect(await AdminIndexingPolicy.allowed()).toBe(false);
  });

  it('allows only an explicit true', async () => {
    vi.stubGlobal('fetch', answering({ searchIndexing: true }));

    expect(await AdminIndexingPolicy.allowed()).toBe(true);
  });

  it.each([['string "true"', 'true'], ['1', 1], ['null', null]])(
    'does not treat %s as consent', async (_label, value) => {
      vi.stubGlobal('fetch', answering({ searchIndexing: value }));

      expect(await AdminIndexingPolicy.allowed()).toBe(false);
    });

  it('fails CLOSED when the api cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }) as never);

    expect(await AdminIndexingPolicy.allowed()).toBe(false);
  });

  it('fails closed on a non-ok response too', async () => {
    vi.stubGlobal('fetch', answering({ searchIndexing: true }, false));

    expect(await AdminIndexingPolicy.allowed()).toBe(false);
  });

  it('caches, so the header does not cost an api call per request', async () => {
    const fetcher = answering({ searchIndexing: true });
    vi.stubGlobal('fetch', fetcher);

    await AdminIndexingPolicy.allowed();
    await AdminIndexingPolicy.allowed();
    await AdminIndexingPolicy.allowed();

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
