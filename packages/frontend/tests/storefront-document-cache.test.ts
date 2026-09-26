import { afterEach, describe, expect, it } from 'vitest';
import { StorefrontDocumentCache } from '@/lib/document/storefront-document-cache';

const params = (query = '') => new URLSearchParams(query);
const frontend = (revision: string, extra: Record<string, unknown> = {}) => ({ contentRevision: revision, activeTheme: { slug: 't', version: '1' }, ...extra });
const keyOf = (overrides: Partial<Parameters<typeof StorefrontDocumentCache.key>[0]> = {}) => StorefrontDocumentCache.key({
  host: 'shop.example', pathname: '/', searchParams: params(), locale: '', encoding: 'br', frontend: frontend('a.0.1'), ...overrides,
});
const html = (text: string, status = 200, extra: Record<string, string> = {}) => new Response(text, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...extra } });

afterEach(() => StorefrontDocumentCache.reset());

describe('StorefrontDocumentCache: who is served from it', () => {
  it('serves anonymous GET and HEAD navigations', () => {
    expect(StorefrontDocumentCache.cacheable('GET', ['fc_locale', 'fc_consent_vid'], params())).toBe(true);
    expect(StorefrontDocumentCache.cacheable('HEAD', [], params('locale=bg'))).toBe(true);
  });

  it('never serves a signed-in visitor, an operator or a preview holder', () => {
    for (const cookie of ['userToken', 'fc_token', 'fc_site_preview']) {
      expect(StorefrontDocumentCache.cacheable('GET', [cookie], params()), cookie).toBe(false);
    }
  });

  it('never serves a request carrying any other query (preview, editor sessions, plugin links)', () => {
    expect(StorefrontDocumentCache.cacheable('GET', [], params('preview=1'))).toBe(false);
    expect(StorefrontDocumentCache.cacheable('GET', [], params('booking=42'))).toBe(false);
    expect(StorefrontDocumentCache.cacheable('POST', [], params())).toBe(false);
  });
});

describe('StorefrontDocumentCache: what makes an entry stale', () => {
  it('changes key with the site content revision, the site payload, the path, the locale and the encoding', () => {
    const base = keyOf();
    expect(keyOf()).toBe(base);
    expect(keyOf({ frontend: frontend('a.0.2') })).not.toBe(base);
    expect(keyOf({ frontend: frontend('a.0.1', { activeTheme: { slug: 't', version: '2' } }) })).not.toBe(base);
    expect(keyOf({ pathname: '/blog' })).not.toBe(base);
    expect(keyOf({ locale: 'bg' })).not.toBe(base);
    expect(keyOf({ encoding: 'gzip' })).not.toBe(base);
    expect(keyOf({ host: 'other.example' })).not.toBe(base);
  });

  it('has no key without a content revision, so an older api is never cached', () => {
    expect(keyOf({ frontend: { activeTheme: {} } })).toBeNull();
    expect(keyOf({ frontend: null })).toBeNull();
  });
});

describe('StorefrontDocumentCache: storing and serving', () => {
  it('stores a 200 document on a miss and serves the same bytes on a hit', async () => {
    const key = keyOf() as string;
    expect(StorefrontDocumentCache.read(key)).toBeNull();
    const first = await StorefrontDocumentCache.write(key, html('<p>page</p>'));
    expect(first.headers.get(StorefrontDocumentCache.STATUS_HEADER)).toBe('miss');
    expect(await first.text()).toBe('<p>page</p>');
    const hit = StorefrontDocumentCache.read(key) as Response;
    expect(hit.headers.get(StorefrontDocumentCache.STATUS_HEADER)).toBe('hit');
    expect(hit.headers.get('content-type')).toContain('text/html');
    expect(await hit.text()).toBe('<p>page</p>');
    expect(await (StorefrontDocumentCache.read(key) as Response).text()).toBe('<p>page</p>');
  });

  it('never stores a redirect, a holding page, an error, a cookie-setting response or a non-document', async () => {
    const cases = [html('x', 503), html('x', 500), html('x', 302), html('x', 200, { 'Set-Cookie': 'a=b' }), new Response('{}', { headers: { 'Content-Type': 'application/json' } })];
    for (const [index, response] of cases.entries()) {
      const key = `k${index}`;
      const sent = await StorefrontDocumentCache.write(key, response);
      expect(sent.headers.get(StorefrontDocumentCache.STATUS_HEADER), String(index)).toBe('bypass');
      expect(StorefrontDocumentCache.read(key), String(index)).toBeNull();
    }
  });

  it('keeps a themed 404 document', async () => {
    await StorefrontDocumentCache.write('nf', html('not found', 404));
    expect((StorefrontDocumentCache.read('nf') as Response).status).toBe(404);
  });

  it('drops the least recently used entries past its size budget', async () => {
    const big = 'x'.repeat(3 * 1024 * 1024);
    for (let i = 0; i < 12; i += 1) await StorefrontDocumentCache.write(`big${i}`, html(big));
    expect(StorefrontDocumentCache.read('big0')).toBeNull();
    expect(StorefrontDocumentCache.read('big11')).not.toBeNull();
  });
});
