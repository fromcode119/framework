import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentResponseHeaders } from '@/lib/document/document-response-headers';
import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { ServerApiUtils } from '@/lib/server-api/server-api';

const html = (body = '<html></html>', type = 'text/html; charset=utf-8') =>
  new Response(body, { status: 200, headers: { 'content-type': type, 'x-fc-document-cache': 'hit' } });

const providerConfig = (path = 'document-headers') => ({
  plugins: [{ slug: 'seo', ui: {} }, { slug: 'security', ui: { documentHeadersPath: path } }],
});

const answer = (headers: unknown) => ({ valueOrThrow: () => ({ headers }) }) as any;

describe('DocumentResponseHeaders', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    DocumentResponseHeaders.reset();
  });

  it('keeps only the allowed security headers with single-line values', () => {
    expect(DocumentResponseHeaders.sanitize({
      'Strict-Transport-Security': 'max-age=31536000',
      'Content-Security-Policy-Report-Only': "default-src 'self'",
      'Set-Cookie': 'a=b',
      'X-Powered-By': 'me',
      'Permissions-Policy': 'camera=()\r\nSet-Cookie: x=y',
      'cross-origin-opener-policy': '',
    })).toEqual({
      'strict-transport-security': 'max-age=31536000',
      'content-security-policy-report-only': "default-src 'self'",
    });
  });

  it('adds the headers to an HTML page and keeps what the page already had', async () => {
    const out = DocumentResponseHeaders.apply(html('<p>hi</p>'), { 'strict-transport-security': 'max-age=60' });
    expect(out.headers.get('strict-transport-security')).toBe('max-age=60');
    expect(out.headers.get('x-fc-document-cache')).toBe('hit');
    expect(out.status).toBe(200);
    expect(await out.text()).toBe('<p>hi</p>');
  });

  it('leaves a response that is not a page untouched', () => {
    const redirect = new Response(null, { status: 308, headers: { location: '/x' } });
    expect(DocumentResponseHeaders.apply(redirect, { 'strict-transport-security': 'max-age=60' })).toBe(redirect);
  });

  it('asks the declaring plugin once per host within the window', async () => {
    vi.spyOn(FrontendConfigCache, 'read').mockResolvedValue(providerConfig() as any);
    const fetch = vi.spyOn(ServerApiUtils, 'serverFetchJsonOutcome').mockResolvedValue(answer({ 'Permissions-Policy': 'camera=()' }));
    expect(await DocumentResponseHeaders.forSite('Example.com')).toEqual({ 'permissions-policy': 'camera=()' });
    expect(await DocumentResponseHeaders.forSite('example.com')).toEqual({ 'permissions-policy': 'camera=()' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0][0])).toContain('/plugins/security/document-headers');
  });

  it('sends nothing when no plugin declares a provider or the provider fails', async () => {
    vi.spyOn(FrontendConfigCache, 'read').mockResolvedValue({ plugins: [{ slug: 'seo', ui: {} }] } as any);
    expect(await DocumentResponseHeaders.forSite('a.example')).toEqual({});
    vi.spyOn(FrontendConfigCache, 'read').mockResolvedValue(providerConfig() as any);
    vi.spyOn(ServerApiUtils, 'serverFetchJsonOutcome').mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await DocumentResponseHeaders.forSite('b.example')).toEqual({});
  });
});
