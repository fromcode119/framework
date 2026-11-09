import { beforeEach, describe, expect, it, vi } from 'vitest';

const config = { current: { contentRevision: 'r1', site: { id: 1 } } as Record<string, unknown> | null };
vi.mock('@/lib/frontend-config-cache', () => ({ FrontendConfigCache: { read: async () => config.current } }));

const { RequestScope } = await import('@/lib/request-scope');
const { SiteRevisionMemo } = await import('@/lib/site-revision-memo');

describe('SiteRevisionMemo', () => {
  beforeEach(() => {
    SiteRevisionMemo.reset();
    config.current = { contentRevision: 'r1', site: { id: 1 } };
  });

  it('serves the next anonymous request from what the previous one fetched', async () => {
    let calls = 0;
    const read = SiteRevisionMemo.memo(async (locale: string) => { calls += 1; return locale; });
    await RequestScope.run(async () => { await read('bg'); }, { shareKey: 'https://a' });
    await RequestScope.run(async () => { await read('bg'); }, { shareKey: 'https://a' });
    expect(calls).toBe(1);
  });

  it('fetches again once the revision or the payload changes', async () => {
    let calls = 0;
    const read = SiteRevisionMemo.memo(async () => { calls += 1; return calls; });
    await RequestScope.run(async () => { await read(); }, { shareKey: 'https://a' });
    config.current = { contentRevision: 'r2', site: { id: 1 } };
    await RequestScope.run(async () => { await read(); }, { shareKey: 'https://a' });
    config.current = { contentRevision: 'r2', site: { id: 1 }, activeTheme: { slug: 'x' } };
    await RequestScope.run(async () => { await read(); }, { shareKey: 'https://a' });
    expect(calls).toBe(3);
  });

  it('never shares with a personal request, another origin, or a payload without a revision', async () => {
    let calls = 0;
    const read = SiteRevisionMemo.memo(async () => { calls += 1; return calls; });
    await RequestScope.run(async () => { await read(); }, { shareKey: 'https://a' });
    await RequestScope.run(async () => { await read(); });
    await RequestScope.run(async () => { await read(); }, { shareKey: 'https://b' });
    config.current = { site: { id: 1 } };
    await RequestScope.run(async () => { await read(); }, { shareKey: 'https://a' });
    await RequestScope.run(async () => { await read(); }, { shareKey: 'https://a' });
    expect(calls).toBe(5);
  });

  it('does not keep a failed fetch', async () => {
    let calls = 0;
    const read = SiteRevisionMemo.memo(async () => { calls += 1; if (calls === 1) throw new Error('down'); return calls; });
    await RequestScope.run(async () => { await expect(read()).rejects.toThrow('down'); }, { shareKey: 'https://a' });
    const value = await RequestScope.run(async () => read(), { shareKey: 'https://a' });
    expect(value).toBe(2);
  });

  it('asks again for an answer keep() refuses — a 404 lookup reaches the api every time', async () => {
    let calls = 0;
    const resolve = SiteRevisionMemo.memo(async (slug: string) => { calls += 1; return slug === 'login' ? { doc: { id: 1 } } : null; }, (r) => Boolean(r?.doc));
    for (let i = 0; i < 3; i += 1) {
      await RequestScope.run(async () => { await resolve('login'); await resolve('nope'); }, { shareKey: 'https://a' });
    }
    expect(calls).toBe(1 + 3);
  });

  it('keeps a site-wide answer while another function or another site fills its own bound', async () => {
    let dictionaryCalls = 0;
    const dictionary = SiteRevisionMemo.memo(async () => { dictionaryCalls += 1; return 'words'; });
    const page = SiteRevisionMemo.memo(async (slug: string) => slug);
    await RequestScope.run(async () => { await dictionary(); }, { shareKey: 'https://a' });
    // A crawl: far more distinct pages than one bound, on this site and on another.
    await RequestScope.run(async () => { for (let i = 0; i < 600; i++) await page(`p${i}`); }, { shareKey: 'https://a' });
    await RequestScope.run(async () => { for (let i = 0; i < 600; i++) await page(`p${i}`); }, { shareKey: 'https://b' });
    await RequestScope.run(async () => { await dictionary(); }, { shareKey: 'https://a' });
    expect(dictionaryCalls).toBe(1);
  });

  it('bounds one function on one site to its own most recent entries', async () => {
    let calls = 0;
    const page = SiteRevisionMemo.memo(async (slug: string) => { calls += 1; return slug; });
    await RequestScope.run(async () => { for (let i = 0; i < 300; i++) await page(`p${i}`); }, { shareKey: 'https://a' });
    calls = 0;
    await RequestScope.run(async () => { await page('p299'); await page('p0'); }, { shareKey: 'https://a' });
    expect(calls).toBe(1);
  });

  it('leaves no partition behind for an answer it does not keep, and bounds how many origins it holds', async () => {
    const missing = SiteRevisionMemo.memo(async () => null, () => false);
    const page = SiteRevisionMemo.memo(async (slug: string) => slug);
    for (let i = 0; i < 50; i++) await RequestScope.run(async () => { await missing(); }, { shareKey: `https://forged-${i}` });
    await Promise.resolve();
    expect((SiteRevisionMemo as any).partitions.size).toBe(0);
    for (let i = 0; i < 500; i++) await RequestScope.run(async () => { await page('x'); }, { shareKey: `https://forged-${i}` });
    expect((SiteRevisionMemo as any).partitions.size).toBeLessThanOrEqual(128);
    expect((SiteRevisionMemo as any).size).toBeLessThanOrEqual(128);
  });
});
