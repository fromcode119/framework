import http from 'http';
import { ApiPathUtils } from '@core/api/api-path-utils';
import { RouteConstants } from '@core/constants/route.constants';
import { InternalServiceAuth } from '@core/security/internal-service-auth';
import { TenantRouteMap } from '@core/tenant/tenant-route-map';

/**
 * Renders every site's home page once on a new frontend, before it takes a single visitor.
 *
 * A site's theme renders in its own process, started on the first request that needs it — on this
 * server about 25 seconds, during which every other render on the box slows down too. Measured on four
 * consecutive deploys: the first visitor to each site after a release waited 15–25 seconds or got a 500
 * ("Frontend could not reach the API"), and the platform monitor reported the sites down. Rendering each
 * site here, on the warm-up port, moves that wait from the first visitor to the deploy.
 *
 * Never fails the start: a site that does not answer in time is logged and left to warm on its first
 * request, as before, and the whole pass is bounded so a release can never hang on it.
 */
export class FrontendWarmup {
  /** Per site: a cold theme process on this server takes ~25 s; twice that is a site that is not coming. */
  static readonly SITE_TIMEOUT_MS = 60_000;
  /** The whole pass, well inside the 240 s a rolling deploy waits for the new frontend to answer. */
  static readonly TOTAL_BUDGET_MS = 150_000;
  private static readonly MAP_TIMEOUT_MS = 10_000;

  /** The warm-up port is the public one plus this. Never published and never named by the gateway. */
  static readonly PORT_OFFSET = 100;

  /**
   * Where Next starts before it takes visitors: another port, but the SAME hostname as the public one.
   * Next answers a middleware rewrite to its own host itself only when the destination matches the
   * hostname it was started with; started as 127.0.0.1, the storefront's `/` → `/fc-document` rewrite was
   * instead proxied to itself with the visitor's https scheme — TLS to a plain port — and every storefront
   * answered 500 (production, 2026-10-01, 0.2.290).
   */
  static listen(port: number, hostname: string): { port: number; hostname: string } {
    return { port: port + FrontendWarmup.PORT_OFFSET, hostname };
  }

  constructor(
    private readonly apiBase: string,
    private readonly localPort: number,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly log: (line: string) => void = (line) => console.log(`[frontend-warmup] ${line}`),
  ) {}

  /** What was warmed: each site's host with the status it answered, or the reason it did not. */
  async run(now: () => number = Date.now): Promise<Array<{ host: string; result: string }>> {
    const hosts = await this.siteHosts();
    const deadline = now() + FrontendWarmup.TOTAL_BUDGET_MS;
    const results: Array<{ host: string; result: string }> = [];
    for (const host of hosts) {
      const left = deadline - now();
      if (left <= 0) {
        results.push({ host, result: 'skipped (warm-up time used up)' });
        continue;
      }
      const started = now();
      const result = await this.render(host, Math.min(left, FrontendWarmup.SITE_TIMEOUT_MS));
      results.push({ host, result });
      this.log(`${host}: ${result} in ${now() - started} ms`);
    }
    return results;
  }

  private async siteHosts(): Promise<string[]> {
    if (!this.apiBase || !InternalServiceAuth.isConfigured()) {
      this.log('no api address or internal secret; nothing to warm');
      return [];
    }
    try {
      const url = `${this.apiBase}${ApiPathUtils.versioned(RouteConstants.SEGMENTS.INTERNAL_ROUTING)}`;
      const response = await this.fetchImpl(url, { headers: InternalServiceAuth.requestHeaders(), signal: AbortSignal.timeout(FrontendWarmup.MAP_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`routing map answered ${response.status}`);
      return TenantRouteMap.fromJson(await response.json()).siteHosts();
    } catch (error: any) {
      this.log(`could not read the sites to warm (${error?.message ?? error}); they warm on first request`);
      return [];
    }
  }

  /** Over `http`, not `fetch`: fetch treats `Host` as a forbidden header, and the host is what picks the site. */
  private render(host: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve) => {
      const request = http.get({
        host: '127.0.0.1',
        port: this.localPort,
        path: '/',
        // As the gateway sends it: the host, and nothing claiming https — Next's own internal rewrite takes
        // its scheme from the request, and an https rewrite to this plain port fails every render.
        headers: { host, 'x-forwarded-host': host },
        timeout: timeoutMs,
      }, (response) => {
        response.resume();
        response.on('end', () => resolve(String(response.statusCode ?? '')));
        response.on('error', (error) => resolve(`no answer (${error.message})`));
      });
      request.on('timeout', () => request.destroy(new Error('timed out')));
      request.on('error', (error) => resolve(`no answer (${error.message})`));
    });
  }
}
