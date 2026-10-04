import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { ServerApiPaths } from '@/lib/server-api/server-api-paths';
import { ServerApiUtils } from '@/lib/server-api/server-api';

/**
 * Security headers a plugin adds to a site's pages.
 *
 * A plugin opts in by declaring `ui.documentHeadersPath` in its manifest: a route of its own that
 * answers, for the site being rendered, `{ headers: { <name>: <value> } }`. Which headers a site sends
 * is that site's decision (HSTS pins its domain, a Content-Security-Policy can break its pages), so the
 * values come from the plugin's per-site settings and the framework never invents one.
 *
 * Only the names in ALLOWED are honoured, and a value with a line break is dropped, so a provider can
 * neither set a cookie nor split the response. An answer is kept per host for TTL_MS: a cached page
 * still carries the headers without a plugin request on every visit, and a change in the admin
 * reaches the site within that window. When the provider cannot be reached the page is served without
 * them rather than not at all.
 */
export class DocumentResponseHeaders {
  static readonly ALLOWED = new Set([
    'content-security-policy',
    'content-security-policy-report-only',
    'strict-transport-security',
    'permissions-policy',
    'cross-origin-opener-policy',
    'cross-origin-resource-policy',
    'cross-origin-embedder-policy',
    'reporting-endpoints',
  ]);

  static readonly TTL_MS = 30_000;

  private static readonly MAX_VALUE_LENGTH = 4096;

  private static readonly cache = new Map<string, { expiresAt: number; headers: Record<string, string> }>();

  /** The headers for the site at `host`, from its provider; `{}` when there is none or it failed. */
  static async forSite(host: string): Promise<Record<string, string>> {
    const key = String(host || '').toLowerCase();
    const cached = DocumentResponseHeaders.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.headers;
    const headers = await DocumentResponseHeaders.fetch();
    DocumentResponseHeaders.cache.set(key, { expiresAt: Date.now() + DocumentResponseHeaders.TTL_MS, headers });
    return headers;
  }

  /** `response` with `headers` added; a non-HTML response (a redirect, a file) is returned as it is. */
  static apply(response: Response, headers: Record<string, string>): Response {
    const names = Object.keys(headers);
    if (!names.length) return response;
    if (!String(response.headers.get('content-type') || '').toLowerCase().startsWith('text/html')) return response;
    const merged = new Headers(response.headers);
    for (const name of names) merged.set(name, headers[name]);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
  }

  /** Keeps the allowed names with a single-line value of sensible length; drops everything else. */
  static sanitize(raw: unknown): Record<string, string> {
    const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const clean: Record<string, string> = {};
    for (const [name, value] of Object.entries(source)) {
      const lower = String(name).trim().toLowerCase();
      const text = String(value ?? '').trim();
      if (!DocumentResponseHeaders.ALLOWED.has(lower) || !text) continue;
      if (/[\r\n]/.test(text) || text.length > DocumentResponseHeaders.MAX_VALUE_LENGTH) continue;
      clean[lower] = text;
    }
    return clean;
  }

  static reset(): void {
    DocumentResponseHeaders.cache.clear();
  }

  private static async fetch(): Promise<Record<string, string>> {
    try {
      const provider = await DocumentResponseHeaders.resolveProvider();
      if (!provider) return {};
      const outcome = await ServerApiUtils.serverFetchJsonOutcome(ServerApiPaths.buildPluginPath(provider.pluginSlug, provider.path));
      const data = outcome.valueOrThrow(provider.path) as { headers?: unknown } | null;
      return DocumentResponseHeaders.sanitize(data?.headers);
    } catch (error) {
      console.warn(`[frontend] document headers unavailable: ${String((error as Error)?.message || error)}`);
      return {};
    }
  }

  /** The first plugin, in the api's plugin order, that declares `ui.documentHeadersPath`. */
  private static async resolveProvider(): Promise<{ pluginSlug: string; path: string } | null> {
    const config = await FrontendConfigCache.read();
    const plugins = Array.isArray(config?.plugins) ? (config?.plugins as Array<Record<string, unknown>>) : [];
    for (const plugin of plugins) {
      const pluginSlug = String(plugin?.slug || '').trim();
      const ui = plugin?.ui as Record<string, unknown> | undefined;
      const path = String(ui?.documentHeadersPath || '').trim().replace(/^\/+/, '');
      if (pluginSlug && path) return { pluginSlug, path };
    }
    return null;
  }
}
