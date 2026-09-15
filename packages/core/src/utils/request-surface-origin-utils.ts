export class RequestSurfaceOriginUtils {
  static hasAdminOriginSignal(
    requestLike: {
      headers?: Record<string, unknown>;
      get?: (name: string) => string | undefined;
    },
    readHeader: (requestLike: {
      headers?: Record<string, unknown>;
      get?: (name: string) => string | undefined;
    }, headerName: string) => string,
    readAbsoluteUrl: (value: unknown) => URL | null,
    isAdminAbsoluteUrl: (url: URL) => boolean,
  ): boolean {
    return RequestSurfaceOriginUtils.readAbsoluteUrlCandidates(requestLike, readHeader, readAbsoluteUrl)
      .some((url) => isAdminAbsoluteUrl(url));
  }

  static hasFrontendOriginSignal(
    requestLike: {
      headers?: Record<string, unknown>;
      get?: (name: string) => string | undefined;
    },
    readHeader: (requestLike: {
      headers?: Record<string, unknown>;
      get?: (name: string) => string | undefined;
    }, headerName: string) => string,
    readAbsoluteUrl: (value: unknown) => URL | null,
    isFrontendAbsoluteUrl: (url: URL) => boolean,
  ): boolean {
    return RequestSurfaceOriginUtils.readAbsoluteUrlCandidates(requestLike, readHeader, readAbsoluteUrl)
      .some((url) => isFrontendAbsoluteUrl(url));
  }

  /**
   * The absolute address this request arrived on, from the proxy's headers.
   *
   * `x-forwarded-host` before `host`: behind the gateway the api sees its own internal name in
   * `host`, and the forwarded one is the address the browser actually used — which is the only one
   * worth comparing against a configured URL. Proto defaults to https because every deployment that
   * configures an admin URL serves it over TLS; getting it wrong only ever costs a scheme mismatch,
   * never a false positive on the host.
   */
  private static selfUrl(
    requestLike: { headers?: Record<string, unknown>; get?: (name: string) => string | undefined },
    readHeader: (requestLike: { headers?: Record<string, unknown>; get?: (name: string) => string | undefined }, headerName: string) => string,
  ): string {
    const host = String(readHeader(requestLike, 'x-forwarded-host') || readHeader(requestLike, 'host') || '')
      .split(',')[0]
      .trim();
    if (!host) return '';
    const proto = String(readHeader(requestLike, 'x-forwarded-proto') || '').split(',')[0].trim() || 'https';
    return `${proto}://${host}`;
  }

  static readAbsoluteUrlCandidates(
    requestLike: {
      headers?: Record<string, unknown>;
      get?: (name: string) => string | undefined;
    },
    readHeader: (requestLike: {
      headers?: Record<string, unknown>;
      get?: (name: string) => string | undefined;
    }, headerName: string) => string,
    readAbsoluteUrl: (value: unknown) => URL | null,
  ): URL[] {
    const values = [
      readHeader(requestLike, 'origin'),
      readHeader(requestLike, 'referer'),
      // THE REQUEST'S OWN ADDRESS, and it is the only candidate a top-level navigation always has.
      //
      // `origin` and `referer` are sent by fetch and by link clicks; a DOWNLOAD, a `window.open` or a
      // pasted address sends neither. So a PDF opened from the console arrived looking like traffic
      // from nowhere, admin detection failed, tenancy fell back to resolving the host as a SITE, and
      // the console's own host is not one: `404 unknown_host` on a document the operator was looking
      // at the admin page for. Every download and direct link in the admin had the same hole.
      //
      // This is not a guess about the host — it is the address the operator configured as
      // `admin_url`, compared against the address the request actually arrived on. A request that
      // reaches the console's own URL IS console traffic, whatever headers a browser chose to omit.
      RequestSurfaceOriginUtils.selfUrl(requestLike, readHeader),
    ];

    const seen = new Set<string>();
    const urls: URL[] = [];
    for (const value of values) {
      const parsed = readAbsoluteUrl(value);
      if (!parsed) {
        continue;
      }

      const key = parsed.toString();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      urls.push(parsed);
    }

    return urls;
  }
}