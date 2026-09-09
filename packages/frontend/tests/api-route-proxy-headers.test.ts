import { describe, expect, it } from 'vitest';
import { ApiRouteProxy } from '@/lib/api-route-proxy';

/**
 * The same-origin `/api/*` proxy reads the upstream body with `fetch`, which DECOMPRESSES it. Passing the
 * upstream's `Content-Encoding` through with a decoded body is what killed every theme and plugin bundle
 * in the browser: `ERR_CONTENT_DECODING_FAILED`, an SSR-only storefront, and no console error the server
 * ever sees.
 */
describe('ApiRouteProxy response headers', () => {
  const build = (input: Record<string, string>): Headers =>
    (ApiRouteProxy as unknown as { buildResponseHeaders(h: Headers): Headers })
      .buildResponseHeaders(new Headers(input));

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
