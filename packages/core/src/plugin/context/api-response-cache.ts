import type { NextFunction, Request, Response } from 'express';
import { CookieConstants } from '@core/constants/cookie.constants';
import { RequestContextUtils } from '@core/context/request-context';
import { SiteContentRevision } from '@core/tenant/site-content-revision';
import { ProcessSignals } from '@core/signals/process-signals';
import { ProcessSignal } from '@core/signals/enums/process-signal.enum';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IStoredApiResponse } from '@core/plugin/context/interfaces/stored-api-response.interface';

/**
 * Answers to anonymous GETs of plugin routes that DECLARED they are the same for every anonymous
 * visitor (`{ access, anonymousCache: true }`), kept so a repeat is not built again.
 *
 * A product list built fresh crosses into the plugin's process and back once per query; the same
 * list for the next visitor is byte-for-byte the same. The storefront already keeps rendered pages
 * on the same terms (StorefrontDocumentCache); this is that, one layer down.
 *
 * WHAT MAKES AN ENTRY STALE. The key carries the site, the plugin and its version, the locale, the
 * path and query, and the site's content revision — bumped by every write that can reach a page (a
 * plugin's own tables, a saved collection, a plugin's settings, a platform setting, a purge). A
 * change to which sites, plugins or themes run where, or to any setting, starts a new generation.
 * And no entry outlives the operator's maximum age (`api_response_cache_seconds`; 0 turns the cache
 * off), which bounds what no write announces: a sale that starts at a set time.
 *
 * WHO IS NEVER SERVED FROM IT: a request with a session, preview or API credential, a signed-in
 * user, any method but GET, and any route that did not opt in. Only a plain 200 JSON answer whose
 * handler set no cookie is kept — a cookie the framework already put on the response before the route
 * (the visitor's CSRF token) belongs to that visitor, is not kept, and is set again on every hit. A disabled plugin, or one a site does not run, is never answered from it.
 *
 * In memory, per api process, bounded by size with the least recently used first out.
 */
export class ApiResponseCache {
  static readonly STATUS_HEADER = 'X-Fc-Api-Cache';
  private static readonly MAX_BYTES = 32 * 1024 * 1024;
  private static readonly MAX_ENTRY_BYTES = 2 * 1024 * 1024;
  private static readonly PERSONAL_COOKIES = new Set<string>([...CookieConstants.AUTH_COOKIES_TO_CLEAR, CookieConstants.SITE_PREVIEW]);
  private static readonly entries = new Map<string, IStoredApiResponse>();
  private static bytes = 0;
  private static generation = 0;
  private static maxAge: () => number = () => 0;

  /** The operator's maximum age in seconds, read per request; 0 or less turns the cache off. */
  static useMaxAge(resolver: () => number): void {
    ApiResponseCache.maxAge = resolver;
  }

  private static readonly forgetting = [
    ProcessSignal.SETTINGS_WRITTEN,
    ProcessSignal.CACHE_PURGED,
    ProcessSignal.SITES_CHANGED,
    ProcessSignal.PLUGIN_ACCESS_CHANGED,
    ProcessSignal.THEME_ACCESS_CHANGED,
  ].map((signal) => ProcessSignals.on(signal, () => ApiResponseCache.clear()));

  /** Everything, at once: a new generation, and the memory back. */
  static clear(): void {
    ApiResponseCache.generation += 1;
    ApiResponseCache.entries.clear();
    ApiResponseCache.bytes = 0;
  }

  /** The middleware for one opted-in route of `plugin`; `lookup` answers the plugin as it is now. */
  static middleware(plugin: ILoadedPlugin, lookup: () => ILoadedPlugin | undefined) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const maxAgeMs = Math.max(0, Number(ApiResponseCache.maxAge()) || 0) * 1000;
      if (req.method !== 'GET' || !(maxAgeMs > 0)) return next();
      if (ApiResponseCache.personal(req)) {
        res.setHeader(ApiResponseCache.STATUS_HEADER, 'bypass');
        return next();
      }
      const current = lookup();
      // The route's own gates answer these (403): a cached copy must never stand in for them.
      if (!current || current.state !== PluginState.ACTIVE || !PluginTenantAccess.isVisibleForCurrentTenant(plugin)) return next();

      const key = ApiResponseCache.key(req, current);
      const stored = ApiResponseCache.entries.get(key);
      if (stored && Date.now() - stored.storedAt < maxAgeMs) {
        ApiResponseCache.entries.delete(key);
        ApiResponseCache.entries.set(key, stored);
        for (const [name, value] of stored.headers) res.setHeader(name, value);
        res.setHeader(ApiResponseCache.STATUS_HEADER, 'hit');
        res.status(stored.status).end(stored.body);
        return;
      }
      if (stored) ApiResponseCache.drop(key);
      res.setHeader(ApiResponseCache.STATUS_HEADER, 'miss');
      ApiResponseCache.capture(res, key, ApiResponseCache.generation, ApiResponseCache.cookies(res));
      next();
    };
  }

  /** Test seam. */
  static reset(): void {
    ApiResponseCache.clear();
    ApiResponseCache.maxAge = () => 0;
  }

  private static personal(req: Request): boolean {
    if ((req as any).user) return true;
    const headers = req.headers;
    if (headers.authorization || headers['x-api-key']) return true;
    for (const part of String(headers.cookie ?? '').split(';')) {
      const name = part.split('=')[0]?.trim();
      if (name && ApiResponseCache.PERSONAL_COOKIES.has(name)) return true;
    }
    return false;
  }

  private static key(req: Request, plugin: ILoadedPlugin): string {
    const tenantId = RequestContextUtils.getTenantId() ?? '';
    const url = new URL(String(req.originalUrl || req.url), 'http://cache.local');
    const query = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
    return [
      ApiResponseCache.generation,
      tenantId,
      `${plugin.manifest.slug}@${plugin.manifest.version}`,
      RequestContextUtils.getLocale() ?? '',
      url.pathname,
      query,
      SiteContentRevision.current(tenantId || null),
    ].join('|');
  }

  /** The cookies already on the response, to tell the framework's own from any the handler adds. */
  private static cookies(res: Response): string {
    return JSON.stringify(res.getHeader('set-cookie') ?? null);
  }

  /** Keeps the answer this request is about to send, if it is one worth keeping. */
  private static capture(res: Response, key: string, generation: number, cookiesBefore: string): void {
    const chunks: Buffer[] = [];
    let size = 0;
    const write = res.write.bind(res) as (...args: any[]) => boolean;
    const end = res.end.bind(res) as (...args: any[]) => Response;
    const collect = (chunk: unknown, encoding?: unknown) => {
      if (chunk === undefined || chunk === null || typeof chunk === 'function') return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8');
      size += buffer.length;
      if (size <= ApiResponseCache.MAX_ENTRY_BYTES) chunks.push(buffer);
    };
    (res as any).write = (chunk: unknown, ...rest: unknown[]) => { collect(chunk, rest[0]); return write(chunk, ...rest); };
    (res as any).end = (chunk?: unknown, ...rest: unknown[]) => {
      collect(chunk, rest[0]);
      const result = end(chunk, ...rest);
      ApiResponseCache.store(res, key, generation, chunks, size, cookiesBefore);
      return result;
    };
  }

  private static store(res: Response, key: string, generation: number, chunks: Buffer[], size: number, cookiesBefore: string): void {
    // Cleared while this was being built: the answer may predate the change that cleared it.
    if (generation !== ApiResponseCache.generation) return;
    if (res.statusCode !== 200 || size > ApiResponseCache.MAX_ENTRY_BYTES) return;
    // The handler set a cookie: this answer is someone's, not everyone's.
    if (ApiResponseCache.cookies(res) !== cookiesBefore) return;
    const contentType = String(res.getHeader('content-type') ?? '');
    if (!contentType.includes('application/json')) return;
    const headers: Array<[string, string]> = [];
    // The policy headers the proxy adds for a site's own plugin go back out with every copy.
    for (const name of ['content-type', 'cache-control', 'content-language', 'vary', 'content-security-policy', 'x-content-type-options']) {
      const value = res.getHeader(name);
      if (value !== undefined) headers.push([name, String(value)]);
    }
    const body = Buffer.concat(chunks, size);
    ApiResponseCache.drop(key);
    ApiResponseCache.entries.set(key, { body, status: 200, headers, storedAt: Date.now() });
    ApiResponseCache.bytes += body.length;
    for (const [oldest, entry] of ApiResponseCache.entries) {
      if (ApiResponseCache.bytes <= ApiResponseCache.MAX_BYTES) break;
      ApiResponseCache.entries.delete(oldest);
      ApiResponseCache.bytes -= entry.body.length;
    }
  }

  private static drop(key: string): void {
    const entry = ApiResponseCache.entries.get(key);
    if (!entry) return;
    ApiResponseCache.entries.delete(key);
    ApiResponseCache.bytes -= entry.body.length;
  }
}
