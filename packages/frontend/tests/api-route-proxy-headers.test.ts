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

  it('drops hop-by-hop headers and keeps everything else', () => {
    const out = build({ connection: 'keep-alive', 'keep-alive': 'timeout=5', 'transfer-encoding': 'chunked', etag: 'W/"abc"' });
    for (const dead of ['connection', 'keep-alive', 'transfer-encoding']) expect(out.get(dead)).toBeNull();
    expect(out.get('etag')).toBe('W/"abc"');
  });
});
