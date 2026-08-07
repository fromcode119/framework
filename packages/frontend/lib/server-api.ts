import { SystemConstants, ApiVersionUtils } from '@fromcode119/core/client';
import { ApplicationUrlUtils } from '@fromcode119/core/client';
import { cookies } from 'next/headers';
import { ServerFetchOutcome } from '@/lib/server-fetch-outcome';

export class ServerApiUtils {
  private static readonly SERVER_FETCH_TIMEOUT_MS = Number(process.env.SERVER_FETCH_TIMEOUT_MS || 12000);
  private static readonly DEBUG_SERVER_FETCH = process.env.DEBUG_SERVER_FETCH === '1';
  static buildInternalApiBaseUrl(): string {
    return String(
      process.env.INTERNAL_API_URL || process.env.API_URL || ServerApiUtils.buildFrontendApiBaseUrl(),
    )
      .trim()
      .replace(/\/+$/, '');
  }

  static buildSystemResolvePath(query: URLSearchParams | string): string {
    const queryString = typeof query === 'string' ? query : query.toString();
    return `${SystemConstants.API_PATH.SYSTEM.RESOLVE}?${queryString}`;
  }

  static buildSystemFrontendPath(): string {
    return SystemConstants.API_PATH.SYSTEM.FRONTEND;
  }

  /** The same `/system/i18n?locale=…` the browser provider loads, so a server render resolves keys identically. */
  static buildSystemI18nPath(locale: string): string {
    const encoded = encodeURIComponent(String(locale || '').trim() || 'en');
    return `${SystemConstants.API_PATH.SYSTEM.I18N}?locale=${encoded}`;
  }

  static buildCollectionLookupPath(
    collectionSlug: string,
    options: { id?: string; limit?: number } = {}
  ): string {
    const slug = encodeURIComponent(String(collectionSlug || '').trim());
    const query = new URLSearchParams();
    if (options.id) query.set('id', String(options.id));
    query.set('limit', String(options.limit ?? 1));
    return `${SystemConstants.API_PATH.COLLECTIONS.BASE}/${slug}?${query.toString()}`;
  }

  static buildPluginPath(pluginSlug: string, path = '', query?: URLSearchParams | string): string {
    const plugin = String(pluginSlug || '').trim().replace(/^\/+|\/+$/g, '');
    const suffix = String(path || '').trim();
    const normalizedSuffix = suffix ? `/${suffix.replace(/^\/+/, '')}` : '';
    const queryString = query ? (typeof query === 'string' ? query : query.toString()) : '';
    const fullPath = `${SystemConstants.API_PATH.PLUGINS.BASE}/${encodeURIComponent(plugin)}${normalizedSuffix}`;
    return queryString ? `${fullPath}?${queryString}` : fullPath;
  }

  static extractFirstDoc(result: unknown): unknown {
    if (Array.isArray(result)) return result[0] || null;
    const r = result as Record<string, unknown>;
    if (Array.isArray(r?.docs)) return (r.docs as unknown[])[0] || null;
    return r?.doc || result || null;
  }

  /**
   * The API bases a SERVER render may fetch through, in priority order.
   *
   * `NEXT_PUBLIC_API_URL` is deliberately absent while any server-side base is configured. It is
   * the BROWSER-facing URL: in a container deployment that public hostname does not resolve from
   * inside the frontend container at all. Including it made every fallback attempt stall the full
   * DNS timeout (measured: 8s of `EAI_AGAIN` per attempt) and — far worse — saturate the container
   * resolver, after which the healthy server-side base ALSO failed to resolve. That cascade is what
   * turned published pages into intermittent hard 404s. It stays as a last resort only when nothing
   * server-side is configured, so an initial setup that only sets the public URL still works.
   */
  static getServerApiPrefixes(): string[] {
    const bases = ServerApiUtils.normalizeApiBases([
      process.env.INTERNAL_API_URL,
      process.env.API_URL,
    ]);

    if (bases.length === 0) {
      bases.push(...ServerApiUtils.normalizeApiBases([process.env.NEXT_PUBLIC_API_URL]));
    }

    // Only add localhost fallbacks when NO primary URL is configured
    // (avoids useless connection attempts in Docker where localhost != API)
    // real API base is configured (prevents silent failures during initial setup).
    if (bases.length === 0) {
      for (const fallback of ApplicationUrlUtils.getServerApiBaseUrlCandidates()) {
        if (!bases.includes(fallback)) bases.push(fallback);
      }
    }

    return ServerApiUtils.unique(bases).map((base) => `${base}${ApiVersionUtils.prefix()}`);
  }

  private static normalizeApiBases(values: Array<string | undefined>): string[] {
    return values
      .map((value) => ApplicationUrlUtils.normalizeBaseUrlCandidate(value, { stripApiPath: true }))
      .filter(Boolean)
      .filter((value) => !ServerApiUtils.isLikelyFrontendBase(value))
      .map(ServerApiUtils.trimTrailingSlash);
  }

  static buildFrontendApiBaseUrl(): string {
    const prefixes = ServerApiUtils.getServerApiPrefixes();
    if (!prefixes.length) return ApplicationUrlUtils.LOCALHOST_PRIMARY_API_BASE_URL;
    return prefixes[0].replace(ApiVersionUtils.prefix(), '');
  }

  /**
   * Get the PUBLIC API base URL for browser-accessible resources (e.g. theme assets).
   * Uses NEXT_PUBLIC_API_URL which resolves to the public domain instead of internal Docker hostnames.
   */
  static buildPublicApiBaseUrl(): string {
    return ApplicationUrlUtils.readEnvironmentBaseUrl(['NEXT_PUBLIC_API_URL', 'API_URL'], { stripApiPath: true })
      || ApplicationUrlUtils.LOCALHOST_PRIMARY_API_BASE_URL;
  }

  /**
   * Forward the signed-in visitor's framework session cookie (`userToken`) into
   * server-side API fetches so per-request SSR (force-dynamic pages) resolves with
   * the visitor's identity. Without this the API sees every SSR fetch as anonymous,
   * which makes members-only gated pages render the paywall even for entitled members.
   * Safe outside a request scope: `cookies()` throws there and we forward nothing.
   */
  static async buildForwardedAuthHeaders(): Promise<Record<string, string>> {
    try {
      const store = await cookies();
      const token = store.get('userToken')?.value;
      if (token) return { cookie: `userToken=${token}` };
    } catch {
      // No request scope (e.g. build-time) — nothing to forward.
    }
    return {};
  }

  /**
   * Lenient wrapper: collapses "no such document" and "API unreachable" back into `null`.
   * Only for surfaces that genuinely degrade (theme assets, prefetch hints, i18n dictionary).
   * Anything that decides whether a PAGE exists must use {@link serverFetchJsonOutcome}.
   */
  static async serverFetchJson(path: string): Promise<unknown> {
    return (await ServerApiUtils.serverFetchJsonOutcome(path)).value;
  }

  static async serverFetchJsonOutcome(path: string): Promise<ServerFetchOutcome<unknown>> {
    const requestPath = ServerApiUtils.AdminUrlUtils(path);
    if (!requestPath) {
      if (ServerApiUtils.DEBUG_SERVER_FETCH) {
        console.warn(`[frontend] Skipping fetch due to invalid path: ${String(path)}`);
      }
      return ServerFetchOutcome.resolved<unknown>(null);
    }

    const prefixes = ServerApiUtils.getServerApiPrefixes();
    const forwardedHeaders = await ServerApiUtils.buildForwardedAuthHeaders();
    let lastError: unknown = null;
    let answered = false;

    for (const prefix of prefixes) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ServerApiUtils.SERVER_FETCH_TIMEOUT_MS);
      try {
        const url = /^https?:\/\//i.test(requestPath) ? requestPath : `${prefix}${requestPath}`;
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: forwardedHeaders });
        if (!response.ok) {
          // Only a status that is a real answer (404, 403, …) counts as "the API says there is
          // nothing here". A 429/5xx means it could not serve us — never treat that as absence.
          if (!ServerApiUtils.isUnavailableStatus(response.status)) {
            answered = true;
          } else {
            lastError = new Error(`API responded ${response.status} ${response.statusText}`.trim());
          }
          continue;
        }
        answered = true;
        return ServerFetchOutcome.resolved<unknown>(await response.json());
      } catch (error) {
        ServerApiUtils.rethrowIfControlFlowSignal(error);
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
    }

    if (answered) return ServerFetchOutcome.resolved<unknown>(null);

    ServerApiUtils.reportTransportFailure('fetch', requestPath, lastError);
    return ServerFetchOutcome.unreachable<unknown>(lastError);
  }

  /** Lenient wrapper — see {@link serverFetchJson}. */
  static async serverFetchResponse(path: string, requestInit?: RequestInit): Promise<Response | null> {
    return (await ServerApiUtils.serverFetchResponseOutcome(path, requestInit)).value;
  }

  static async serverFetchResponseOutcome(path: string, requestInit?: RequestInit): Promise<ServerFetchOutcome<Response>> {
    const requestPath = ServerApiUtils.AdminUrlUtils(path);
    if (!requestPath) {
      if (ServerApiUtils.DEBUG_SERVER_FETCH) {
        console.warn(`[frontend] Skipping response fetch due to invalid path: ${String(path)}`);
      }
      return ServerFetchOutcome.resolved<Response>(null);
    }

    const prefixes = ServerApiUtils.getServerApiPrefixes();
    const forwardedHeaders = await ServerApiUtils.buildForwardedAuthHeaders();
    let lastError: unknown = null;
    let lastResponse: Response | null = null;

    for (const prefix of prefixes) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ServerApiUtils.SERVER_FETCH_TIMEOUT_MS);
      try {
        const url = /^https?:\/\//i.test(requestPath) ? requestPath : `${prefix}${requestPath}`;
        const response = await fetch(url, {
          ...requestInit,
          cache: requestInit?.cache ?? 'no-store',
          signal: controller.signal,
          headers: { ...forwardedHeaders, ...(requestInit?.headers as Record<string, string> | undefined) },
        });
        if (!response.ok) {
          lastResponse = response;
          // A 429/5xx is not an answer about this document — keep looking, and if no prefix ever
          // answers, report unreachable rather than handing back a status callers read as "absent".
          if (ServerApiUtils.isUnavailableStatus(response.status)) {
            lastError = new Error(`API responded ${response.status} ${response.statusText}`.trim());
            lastResponse = null;
          }
          continue;
        }
        return ServerFetchOutcome.resolved<Response>(response);
      } catch (error) {
        ServerApiUtils.rethrowIfControlFlowSignal(error);
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
    }

    // A non-OK response is still the API answering — hand it back rather than claiming unreachable.
    if (lastResponse) return ServerFetchOutcome.resolved<Response>(lastResponse);

    ServerApiUtils.reportTransportFailure('fetch response', requestPath, lastError);
    return ServerFetchOutcome.unreachable<Response>(lastError);
  }

  /** Lenient wrapper — see {@link serverFetchJson}. */
  static async serverFetchInternalResponse(path: string, requestInit?: RequestInit): Promise<Response | null> {
    return (await ServerApiUtils.serverFetchInternalResponseOutcome(path, requestInit)).value;
  }

  static async serverFetchInternalResponseOutcome(path: string, requestInit?: RequestInit): Promise<ServerFetchOutcome<Response>> {
    const requestPath = ServerApiUtils.AdminUrlUtils(path);
    if (!requestPath) {
      if (ServerApiUtils.DEBUG_SERVER_FETCH) {
        console.warn(`[frontend] Skipping internal response fetch due to invalid path: ${String(path)}`);
      }
      return ServerFetchOutcome.resolved<Response>(null);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ServerApiUtils.SERVER_FETCH_TIMEOUT_MS);

    try {
      const baseUrl = ServerApiUtils.buildInternalApiBaseUrl();
      const normalizedPath = requestPath.startsWith(ApiVersionUtils.prefix())
        ? requestPath
        : `${ApiVersionUtils.prefix()}${requestPath}`;
      const response = await fetch(`${baseUrl}${normalizedPath}`, {
        ...requestInit,
        cache: requestInit?.cache ?? 'no-store',
        signal: controller.signal,
      });
      return ServerFetchOutcome.resolved<Response>(response);
    } catch (error) {
      ServerApiUtils.rethrowIfControlFlowSignal(error);
      ServerApiUtils.reportTransportFailure('internal response fetch', requestPath, error);
      return ServerFetchOutcome.unreachable<Response>(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  // --- Private helpers ---

  private static isAbortError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const value = error as { name?: string; code?: string };
    return value.name === 'AbortError' || value.code === 'ABORT_ERR';
  }

  /**
   * Next signals control flow by THROWING out of `fetch` — `DynamicServerError`
   * (`digest: 'DYNAMIC_SERVER_USAGE'`) during a static prerender, and the `NEXT_*` digests used by
   * `redirect()` / `notFound()`. Those are not transport failures and must reach Next untouched:
   * swallowing the bailout is what let build-time prerenders capture an empty config, and wrapping
   * it fails the build outright. Re-thrown before any outcome is built.
   */
  /**
   * Statuses that mean "the API could not serve this request", NOT "there is no such document".
   * A 429 or a 5xx says nothing about whether the page exists, so it must never be rendered as a
   * 404 — that asks crawlers to delist a live page because the API was busy. Verified live: a
   * per-IP rate limiter throttling the SSR container turned every published page into a hard 404,
   * because all server-side traffic shares one source IP.
   *
   * 4xx codes that ARE genuine answers (400, 401, 403, 404, 410) are deliberately absent.
   */
  private static readonly UNAVAILABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

  private static isUnavailableStatus(status: number): boolean {
    return ServerApiUtils.UNAVAILABLE_STATUSES.has(status);
  }

  private static rethrowIfControlFlowSignal(error: unknown): void {
    if (!error || typeof error !== 'object') return;
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest !== 'string') return;
    if (digest === 'DYNAMIC_SERVER_USAGE' || digest.startsWith('NEXT_')) throw error;
  }

  /**
   * One place that logs a transport failure, so every fetch helper reports it identically and
   * an unreachable API is never silently swallowed.
   */
  private static reportTransportFailure(kind: string, requestPath: string, error: unknown): void {
    if (ServerApiUtils.isAbortError(error)) {
      console.error(`[frontend] Timed out on ${kind} ${requestPath} after ${ServerApiUtils.SERVER_FETCH_TIMEOUT_MS}ms`);
      return;
    }
    console.error(`[frontend] Failed ${kind} ${requestPath}: ${ServerApiUtils.describeError(error)}`);
  }

  /**
   * `TypeError: fetch failed` on its own says nothing — undici puts the real reason
   * (`EAI_AGAIN`, `ECONNRESET`, `UND_ERR_CONNECT_TIMEOUT`, …) on `error.cause`. Omitting the
   * cause is exactly what hid a dead API prefix behind an anonymous "fetch failed" for so long.
   */
  private static describeError(error: unknown): string {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (!(error instanceof Error)) return String(error);

    const cause = (error as Error & { cause?: unknown }).cause;
    const causeText = ServerApiUtils.describeCause(cause);
    return causeText ? `${error.name}: ${error.message} (cause: ${causeText})` : `${error.name}: ${error.message}`;
  }

  private static describeCause(cause: unknown): string {
    if (!cause) return '';
    if (typeof cause === 'string') return cause;
    const detail = cause as { code?: string; name?: string; message?: string };
    return [detail.code, detail.name, detail.message].filter(Boolean).join(' ').trim();
  }

  private static trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
  }

  private static isLikelyFrontendBase(value: string): boolean {
    try {
      const candidate = new URL(ApplicationUrlUtils.normalizeBaseUrlCandidate(value)).origin.toLowerCase();
      const configuredFrontendOrigins = [
        process.env.FRONTEND_URL,
      ]
        .map((origin) => ApplicationUrlUtils.normalizeBaseUrlCandidate(origin))
        .filter(Boolean)
        .map((origin) => {
          try { return new URL(origin).origin.toLowerCase(); } catch { return ''; }
        })
        .filter(Boolean);
      return configuredFrontendOrigins.includes(candidate);
    } catch {
      return false;
    }
  }

  private static unique(values: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
      if (!value || seen.has(value)) continue;
      seen.add(value);
      output.push(value);
    }
    return output;
  }

  private static AdminUrlUtils(path: unknown): string | null {
    if (typeof path !== 'string') return null;
    const normalized = path.trim();
    if (!normalized || normalized === 'undefined' || normalized === 'null') return null;
    return normalized;
  }
}
