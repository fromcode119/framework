import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeRenderHostPool } from '@/lib/ssr/host/theme-render-host-pool';

/**
 * An extension update gives a site a new render-world signature. The world it left used to stay
 * resident until the generation cap pushed it out, so a few updates filled the storefront with
 * superseded processes at its memory limit.
 */
class FakeHost {
  retired = false;
  readonly isAlive = true;
  constructor(readonly signature: string) {}
  async render() { return null; }
  retire() { this.retired = true; }
  stop() {}
}

describe('ThemeRenderHostPool superseded worlds', () => {
  const started: FakeHost[] = [];
  const pool = ThemeRenderHostPool as any;

  beforeEach(() => {
    pool.hosts = new Map(); pool.recency = []; pool.siteSignatures = new Map(); pool.births = new Map(); pool.born = 0;
    started.length = 0;
    vi.spyOn(pool, 'start').mockImplementation(async (generation: any) => { const host = new FakeHost(generation.signature); started.push(host); return host; });
  });
  afterEach(() => vi.restoreAllMocks());

  const render = (siteId: string, signature: string, cap = 5) => ThemeRenderHostPool.render({
    generation: { signature } as any, settings: { generationCap: cap } as any, frontendDir: '', boot: {} as any, request: {} as any, siteId,
  });

  it('retires the world a site leaves once no site renders with it', async () => {
    await render('shop', 'v1');
    await render('shop', 'v2');
    expect(started.map((host) => [host.signature, host.retired])).toEqual([['v1', true], ['v2', false]]);
  });

  it('keeps a world another site still renders with', async () => {
    await render('a', 'v1');
    await render('b', 'v1');
    await render('a', 'v2');
    expect(started.find((host) => host.signature === 'v1')?.retired).toBe(false);
    await render('b', 'v2');
    expect(started.find((host) => host.signature === 'v1')?.retired).toBe(true);
  });

  it('never brings a superseded world back for a request still carrying the old config', async () => {
    await render('shop', 'v1');
    await render('shop', 'v2');
    await render('shop', 'v1');
    expect(started.map((host) => host.signature)).toEqual(['v1', 'v2']);
    expect(started[1].retired).toBe(false);
  });

  it('at the cap, an update retires its own old world instead of evicting another site', async () => {
    await render('a', 'a1', 2);
    await render('b', 'b1', 2);
    await render('a', 'a1', 2); // site a was served last, so b is the least recently used
    await render('a', 'a2', 2);
    const state = Object.fromEntries(started.map((host) => [host.signature, host.retired]));
    expect(state).toEqual({ a1: true, b1: false, a2: false });
    expect([...pool.hosts.keys()].sort()).toEqual(['a2', 'b1']);
  });
});
