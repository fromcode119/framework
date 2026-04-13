import { SystemConstants, ApiVersionUtils } from '@fromcode119/core/client';
import { ApplicationUrlUtils } from '@fromcode119/core/client';

const SERVER_FETCH_TIMEOUT_MS = Number(process.env.SERVER_FETCH_TIMEOUT_MS || 12000);
const DEBUG_SERVER_FETCH = process.env.DEBUG_SERVER_FETCH === '1';

export class ServerApiUtils {
  static buildSystemResolvePath(query: URLSearchParams | string): string {
    const queryString = typeof query === 'string' ? query : query.toString();
    return `${SystemConstants.API_PATH.SYSTEM.RESOLVE}?${queryString}`;
  }

  static buildSystemFrontendPath(): string {
    return SystemConstants.API_PATH.SYSTEM.FRONTEND;
  }

  static buildSettingsCollectionPath(limit = 500): string {
    const query = new URLSearchParams();
    query.set('limit', String(limit));
    return `${SystemConstants.API_PATH.COLLECTIONS.SETTINGS}?${query.toString()}`;
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

  static getServerApiPrefixes(): string[] {
    const bases: string[] = [
      process.env.API_URL,
      process.env.NEXT_PUBLIC_API_URL,
    ]
      .map((value) => ApplicationUrlUtils.normalizeBaseUrlCandidate(value, { stripApiPath: true }))
      .filter(Boolean)
      .filter((value) => !ServerApiUtils.isLikelyFrontendBase(value))
      .map(ServerApiUtils.trimTrailingSlash);

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

  static async serverFetchJson(path: string): Promise<unknown> {
    const requestPath = ServerApiUtils.AdminUrlUtils(path);
    if (!requestPath) {
      if (DEBUG_SERVER_FETCH) {
        console.warn(`[frontend] Skipping fetch due to invalid path: ${String(path)}`);
      }
      return null;
    }

    const prefixes = ServerApiUtils.getServerApiPrefixes();
    let lastError: unknown = null;

    for (const prefix of prefixes) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SERVER_FETCH_TIMEOUT_MS);
      try {
        const url = /^https?:\/\//i.test(requestPath) ? requestPath : `${prefix}${requestPath}`;
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) continue;
        return response.json();
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
    }

    if (lastError) {
      if (ServerApiUtils.isAbortError(lastError)) {
        if (DEBUG_SERVER_FETCH) console.warn(`[frontend] Fetch timed out for ${requestPath}`);
      } else {
        console.error(`[frontend] Failed to fetch ${requestPath}: ${ServerApiUtils.describeError(lastError)}`);
      }
    }
    return null;
  }

  static async serverFetchResponse(path: string, requestInit?: RequestInit): Promise<Response | null> {
    const requestPath = ServerApiUtils.AdminUrlUtils(path);
    if (!requestPath) {
      if (DEBUG_SERVER_FETCH) {
        console.warn(`[frontend] Skipping response fetch due to invalid path: ${String(path)}`);
      }
      return null;
    }

    const prefixes = ServerApiUtils.getServerApiPrefixes();
    let lastError: unknown = null;
    let lastResponse: Response | null = null;

    for (const prefix of prefixes) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SERVER_FETCH_TIMEOUT_MS);
      try {
        const url = /^https?:\/\//i.test(requestPath) ? requestPath : `${prefix}${requestPath}`;
        const response = await fetch(url, {
          ...requestInit,
          cache: requestInit?.cache ?? 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) { lastResponse = response; continue; }
        return response;
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
    }

    if (lastResponse) return lastResponse;

    if (lastError) {
      if (ServerApiUtils.isAbortError(lastError)) {
        if (DEBUG_SERVER_FETCH) console.warn(`[frontend] Fetch response timed out for ${requestPath}`);
      } else {
        console.error(`[frontend] Failed to fetch response ${requestPath}: ${ServerApiUtils.describeError(lastError)}`);
      }
    }
    return null;
  }

  // --- Private helpers ---

  private static isAbortError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const value = error as { name?: string; code?: string };
    return value.name === 'AbortError' || value.code === 'ABORT_ERR';
  }

  private static describeError(error: unknown): string {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    return String(error);
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