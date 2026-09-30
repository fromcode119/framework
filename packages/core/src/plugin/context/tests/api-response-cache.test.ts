import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import { ApiResponseCache } from '@core/plugin/context/api-response-cache';
import { RequestContextUtils } from '@core/context/request-context';
import { SiteContentRevision } from '@core/tenant/site-content-revision';
import { ProcessSignals } from '@core/signals/process-signals';
import { ProcessSignal } from '@core/signals/enums/process-signal.enum';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { CookieConstants } from '@core/constants/cookie.constants';

/** One opted-in plugin route behind the cache, with a counter of how often the plugin really answered. */
class Harness {
  built = 0;
  plugin: any = { manifest: { slug: 'shop', version: '1.0.0' }, state: PluginState.ACTIVE };
  answer: (req: express.Request, res: express.Response) => void = (req, res) => { res.json({ built: this.built, path: req.path }); };
  private server: any;
  base = '';

  async start(tenantId?: string): Promise<void> {
    const app = express();
    app.use((req, _res, next) => {
      const site = String(req.headers['x-test-site'] ?? tenantId ?? '') || undefined;
      const locale = String(req.headers['x-test-locale'] ?? 'en');
      RequestContextUtils.storage.run({ tenantId: site, locale } as any, () => next());
    });
    app.use((req, _res, next) => { if (req.headers['x-test-user']) (req as any).user = { id: 1 }; next(); });
    app.get('/shop/products', ApiResponseCache.middleware(this.plugin, () => this.plugin), (req, res) => { this.built += 1; this.answer(req, res); });
    await new Promise<void>((resolve) => { this.server = app.listen(0, () => resolve()); });
    this.base = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  get(path = '/shop/products', headers: Record<string, string> = {}) {
    return fetch(this.base + path, { headers }).then(async (res) => ({ status: res.status, cache: res.headers.get(ApiResponseCache.STATUS_HEADER), body: await res.text() }));
  }

  stop(): void { this.server?.close(); }
}

describe('ApiResponseCache', () => {
  let h: Harness;
  beforeEach(async () => { ApiResponseCache.reset(); ApiResponseCache.useMaxAge(() => 60); h = new Harness(); await h.start(); });
  afterEach(() => { h.stop(); ApiResponseCache.reset(); vi.useRealTimers(); });

  it('builds once, then answers repeats from memory with the same bytes', async () => {
    const first = await h.get();
    const second = await h.get();
    expect([first.cache, second.cache]).toEqual(['miss', 'hit']);
    expect(second.body).toBe(first.body);
    expect(h.built).toBe(1);
  });

  it('never serves or keeps for a session, preview, API credential or signed-in user', async () => {
    await h.get();
    for (const headers of [
      { cookie: `${CookieConstants.AUTH_TOKEN}=x` },
      { cookie: `other=1; ${CookieConstants.SITE_PREVIEW}=y` },
      { authorization: 'Bearer t' },
      { 'x-api-key': 'k' },
      { 'x-test-user': '1' },
    ]) {
      expect((await h.get('/shop/products', headers)).cache).toBe('bypass');
    }
    expect(h.built).toBe(6);
    expect((await h.get()).cache).toBe('hit');
  });

  it('a harmless cookie (consent, cart id) does not bypass; the route promised not to read one', async () => {
    await h.get();
    expect((await h.get('/shop/products', { cookie: 'fc_consent=1' })).cache).toBe('hit');
  });

  it('a change on the site is seen by the very next request', async () => {
    await h.get();
    SiteContentRevision.bump(null);
    expect((await h.get()).cache).toBe('miss');
    expect(h.built).toBe(2);
  });

  it('a change to sites, plugins, themes or settings, here or in another process, clears everything', async () => {
    for (const signal of [ProcessSignal.PLUGIN_ACCESS_CHANGED, ProcessSignal.THEME_ACCESS_CHANGED, ProcessSignal.SITES_CHANGED, ProcessSignal.SETTINGS_WRITTEN, ProcessSignal.CACHE_PURGED]) {
      await h.get();
      ProcessSignals.announce(signal);
      expect((await h.get()).cache).toBe('miss');
    }
  });

  it('no answer outlives the maximum age', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    await h.get();
    now.mockReturnValue(1_000_000 + 59_000);
    expect((await h.get()).cache).toBe('hit');
    now.mockReturnValue(1_000_000 + 61_000);
    expect((await h.get()).cache).toBe('miss');
    now.mockRestore();
  });

  it('is off at 0: every request is built, and says nothing', async () => {
    ApiResponseCache.useMaxAge(() => 0);
    const a = await h.get();
    const b = await h.get();
    expect([a.cache, b.cache]).toEqual([null, null]);
    expect(h.built).toBe(2);
  });

  it('keeps only a plain 200 JSON answer that sets no cookie', async () => {
    const cases: Array<(req: express.Request, res: express.Response) => void> = [
      (_req, res) => { res.status(404).json({ error: 'x' }); },
      (_req, res) => { res.cookie('c', '1').json({ ok: 1 }); },
      (_req, res) => { res.type('text/html').send('<p>x</p>'); },
    ];
    for (const answer of cases) {
      ApiResponseCache.clear();
      h.answer = answer;
      const before = h.built;
      await h.get();
      await h.get();
      expect(h.built - before).toBe(2);
    }
  });

  it('never stands in for a disabled plugin', async () => {
    await h.get();
    h.plugin.state = PluginState.INACTIVE;
    expect((await h.get()).cache).toBe(null);
    expect(h.built).toBe(2);
  });

  it('keeps each site, locale and query apart, and treats the same query in any order as one', async () => {
    await h.get('/shop/products?limit=20&currency=EUR', { 'x-test-site': 'site-a' });
    expect((await h.get('/shop/products?currency=EUR&limit=20', { 'x-test-site': 'site-a' })).cache).toBe('hit');
    expect((await h.get('/shop/products?limit=20&currency=EUR', { 'x-test-site': 'site-b' })).cache).toBe('miss');
    expect((await h.get('/shop/products?limit=20&currency=EUR', { 'x-test-site': 'site-a', 'x-test-locale': 'bg' })).cache).toBe('miss');
    expect((await h.get('/shop/products?limit=20&currency=USD', { 'x-test-site': 'site-a' })).cache).toBe('miss');
  });

  it('a plugin update starts new entries', async () => {
    await h.get();
    h.plugin.manifest.version = '1.0.1';
    expect((await h.get()).cache).toBe('miss');
  });

  it('does not keep an answer built across a clear', async () => {
    h.answer = (req, res) => { ApiResponseCache.clear(); res.json({ built: h.built }); };
    await h.get();
    h.answer = (req, res) => { res.json({ built: h.built }); };
    expect((await h.get()).cache).toBe('miss');
  });
});

describe('SiteContentRevision on a single-site install', () => {
  it('a write with no site bound moves the revision every page is rendered under', () => {
    const before = SiteContentRevision.current(null);
    RequestContextUtils.storage.run({} as any, () => SiteContentRevision.bumpCurrentSite());
    expect(SiteContentRevision.current(null)).not.toBe(before);
  });
});
