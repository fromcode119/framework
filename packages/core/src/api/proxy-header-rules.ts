/**
 * Header hygiene for an app that proxies a browser request to the API on its own origin.
 *
 * Both Next apps do this — the storefront so a multi-site deployment can tell WHICH site a call
 * belongs to, the admin because its bundle calls `/api/v1/...` on whatever host it was served from.
 * The rules below are the same in both directions and each one is a fix for something that shipped
 * broken, so they live here once rather than in two `lib/` copies that can drift apart.
 */
export class ProxyHeaderRules {
  /** Hop-by-hop request headers: they describe THIS connection, not the one we are about to open. */
  private static readonly DROPPED_REQUEST_HEADERS = ['host', 'connection', 'content-length'];

  private static readonly DROPPED_RESPONSE_HEADERS = [
    'connection',
    'keep-alive',
    'transfer-encoding',
    // `fetch` DECODES the upstream body, so what the caller forwards is plain bytes. Passing the
    // upstream's `Content-Encoding: gzip` along with them tells the browser to gunzip text that is
    // not gzipped: every theme and plugin bundle failed with ERR_CONTENT_DECODING_FAILED and the
    // storefront ran server-rendered only, with no client runtime at all. The compressed
    // `Content-Length` goes with it — it describes bytes that are no longer being sent, and the
    // platform sets the real one.
    'content-encoding',
    'content-length',
  ];

  /**
   * The headers to send upstream, carrying THE TENANT.
   *
   * A server-to-server fetch reaches the API as `Host: api:3000`, and on a multi-tenant deployment
   * the API routes by host — so without this every proxied call answered `404 unknown_host`. The
   * public host of the INCOMING request is what identifies the site, and `x-forwarded-host` is what
   * the API's tenant router reads first (`RequestTenantService.hostFrom`). Harmless on a
   * single-tenant deployment, where the tenancy middleware passes everything through.
   */
  static forUpstreamRequest(request: Request): Headers {
    const headers = new Headers(request.headers);
    for (const name of ProxyHeaderRules.DROPPED_REQUEST_HEADERS) {
      headers.delete(name);
    }

    const publicHost = ProxyHeaderRules.firstValue(
      request.headers.get('x-forwarded-host') || request.headers.get('host'),
    );
    if (publicHost) {
      headers.set('x-forwarded-host', publicHost);
    }

    const publicProto = ProxyHeaderRules.firstValue(request.headers.get('x-forwarded-proto'));
    if (publicProto) {
      headers.set('x-forwarded-proto', publicProto);
    }

    return headers;
  }

  /**
   * The headers to hand back to the browser, minus everything that described the upstream hop.
   *
   * SET-COOKIE IS COPIED ONE BY ONE, and that is not a detail. `new Headers(response.headers)`
   * COLLAPSES repeated `Set-Cookie` values into a single comma-joined string, which a browser then
   * reads as one malformed cookie — so every header after the first was silently lost on the way
   * through this proxy. Any response that sets more than one cookie was affected: a login sets
   * several, and re-scoping a session emits the new cookie PLUS the clears for the older, wider
   * scopes it must replace. Losing those clears left a stale apex-scoped session cookie in the
   * browser that kept being sent to the api host and kept deciding which site the console was on.
   *
   * `getSetCookie()` is the standard accessor that preserves them; it is used rather than reading
   * `get('set-cookie')`, which returns the same joined string the constructor produces.
   */
  static forDownstreamResponse(headers: Headers): Headers {
    const forwarded = new Headers(headers);
    for (const name of ProxyHeaderRules.DROPPED_RESPONSE_HEADERS) {
      forwarded.delete(name);
    }

    const cookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
    if (cookies.length) {
      forwarded.delete('set-cookie');
      for (const cookie of cookies) forwarded.append('set-cookie', cookie);
    }

    return forwarded;
  }

  /** A proxy chain appends, so `a.example, b.internal` means the client asked for `a.example`. */
  private static firstValue(value: string | null): string {
    return String(value || '').split(',')[0].trim();
  }
}
