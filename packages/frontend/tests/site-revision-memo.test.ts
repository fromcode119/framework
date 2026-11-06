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
});
