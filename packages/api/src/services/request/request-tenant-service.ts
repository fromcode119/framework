/**
 * The public host(s) of a request, as the tenant router sees them.
 *
 * `x-forwarded-host` wins because the edge proxy sets it and `host` is then the internal service
 * name — the same precedence ApiUrlUtils already uses. An absent host yields '', and the caller
 * REFUSES the request rather than guessing: there is no default tenant, because serving one
 * customer's data on an unrecognised domain is the failure this layer exists to prevent.
 *
 * WHY THERE ARE CANDIDATES AND NOT ONE HOST. The server render forwards the site's host, so it
 * resolves. The BROWSER does not: every call it makes lands on the shared API host
 * (`api.framework.local`), which is nobody's site, and the storefront hydrated into
 * `404 unknown_host` for its config, its translations and its theme bundle — a page that painted
 * correctly on the server and then could not boot. The browser DOES tell the API which site it is
 * on, in `Origin` (and `Referer`): headers it sets itself and a page cannot forge. So when the Host
 * names no tenant, the origin's host is tried next. Tenant selection by host was never
 * authentication — data stays behind the session — so this widens nothing a spoofed Host could
 * not already do.
 */
export class RequestTenantService {
  static hostFrom(req: any): string {
    const headers = req?.headers ?? {};
    return RequestTenantService.normalize(headers['x-forwarded-host'] ?? headers.host ?? '');
  }

  /** Hosts to try, most trusted first, de-duplicated and never empty strings. */
  static hostCandidates(req: any): string[] {
    const headers = req?.headers ?? {};
    const fromUrl = (value: unknown): string => {
      const raw = String(value ?? '').trim();
      if (!raw) return '';
      try { return new URL(raw).host; } catch { return ''; }
    };
    const candidates = [
      RequestTenantService.hostFrom(req),
      RequestTenantService.normalize(fromUrl(headers.origin)),
      RequestTenantService.normalize(fromUrl(headers.referer)),
    ];
    return [...new Set(candidates.filter((host) => host.length > 0))];
  }

  private static normalize(raw: unknown): string {
    return String(raw ?? '')
      .split(',')[0]
      .trim()
      .toLowerCase()
      .replace(/:\d+$/, '');
  }
}
