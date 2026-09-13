import { describe, expect, it } from 'vitest';
import { ProxyHeaderRules } from '@fromcode119/core/api/proxy-header-rules';

/**
 * The same-origin `/api/*` proxy reads the upstream body with `fetch`, which DECOMPRESSES it. Passing the
 * upstream's `Content-Encoding` through with a decoded body is what killed every theme and plugin bundle
 * in the browser: `ERR_CONTENT_DECODING_FAILED`, an SSR-only storefront, and no console error the server
 * ever sees.
 *
 * The rules moved out of the storefront proxy into `ProxyHeaderRules` when the admin grew a proxy of
 * its own — one set of rules for both apps. This suite kept calling the method that used to hold
 * them and had been failing ever since, which is the failure mode a shared helper invites: the
 * behaviour moved, the test did not, and nothing was covering it while it looked like it was.
 */
describe('proxy response headers', () => {
  const build = (input: Record<string, string>): Headers =>
    ProxyHeaderRules.forDownstreamResponse(new Headers(input));

  it('drops the encoding headers that no longer describe the body', () => {
    const out = build({ 'content-encoding': 'gzip', 'content-length': '101', 'content-type': 'application/javascript' });
    expect(out.get('content-encoding')).toBeNull();
    expect(out.get('content-length')).toBeNull();
    expect(out.get('content-type')).toBe('application/javascript');
  });

  /**
   * A re-scoped session emits the new cookie PLUS the clears for the wider scopes it replaces, and a
   * login emits several at once, so the proxy must hand back every one of them. This pins that as a
   * CONTRACT rather than a fix: a `Headers` copied from another `Headers` already preserves repeated
   * `Set-Cookie` (verified on Node 22 and 24), but one built from a plain object joins them with
   * commas into a single malformed cookie — so the guarantee is worth asserting where it can regress.
   */
  it('preserves every Set-Cookie rather than collapsing them into one', () => {
    const upstream = new Headers();
    upstream.append('set-cookie', 'fc_token=new; Path=/; HttpOnly; SameSite=Lax');
    upstream.append('set-cookie', 'fc_token=; Domain=.example.com; Path=/; Max-Age=0');
    upstream.append('set-cookie', 'fc_user=; Path=/; Max-Age=0');

    const out = ProxyHeaderRules.forDownstreamResponse(upstream);

    expect(out.getSetCookie()).toEqual([
      'fc_token=new; Path=/; HttpOnly; SameSite=Lax',
      'fc_token=; Domain=.example.com; Path=/; Max-Age=0',
      'fc_user=; Path=/; Max-Age=0',
    ]);
  });

  /** The headers must still arrive intact once handed to the `Response` the route actually returns. */
  it('keeps them intact through the Response the proxy returns', () => {
    const upstream = new Headers();
    upstream.append('set-cookie', 'a=1; Path=/');
    upstream.append('set-cookie', 'b=2; Path=/');

    const response = new Response('{}', { headers: ProxyHeaderRules.forDownstreamResponse(upstream) });

    expect(response.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });

  it('drops hop-by-hop headers and keeps everything else', () => {
    const out = build({ connection: 'keep-alive', 'keep-alive': 'timeout=5', 'transfer-encoding': 'chunked', etag: 'W/"abc"' });
    for (const dead of ['connection', 'keep-alive', 'transfer-encoding']) expect(out.get(dead)).toBeNull();
    expect(out.get('etag')).toBe('W/"abc"');
  });
});
