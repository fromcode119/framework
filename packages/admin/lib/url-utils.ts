import { ApiVersionUtils } from '@fromcode119/core/client';

export class AdminUrlUtils {
  static normalizeRequestPath(path: string): string {
      if (!path) return '/';
      if (path.startsWith('http')) return path;
      const normalized = path.startsWith('/') ? path : `/${path}`;
      const apiPrefix = `${ApiVersionUtils.prefix().split('/v')[0]}/`;
      if (normalized.startsWith(apiPrefix)) return normalized;
      return `${ApiVersionUtils.prefix()}${normalized}`;

  }

  static resolveFrontendBaseUrl(
  settings?: Record<string, unknown> | null,
  explicit?: unknown,
  fallback: string = 'http://frontend.framework.local'
): string {
      const raw =
        AdminUrlUtils.toNonEmptyString(explicit) ||
        AdminUrlUtils.toNonEmptyString(settings?.frontend_url) ||
        AdminUrlUtils.toNonEmptyString(settings?.site_url) ||
        AdminUrlUtils.toNonEmptyString(process.env.FRONTEND_URL) ||
        AdminUrlUtils.toNonEmptyString(process.env.NEXT_PUBLIC_FRONTEND_URL) ||
        AdminUrlUtils.toNonEmptyString(process.env.NEXT_PUBLIC_SITE_URL) ||
        AdminUrlUtils.toNonEmptyString(process.env.PUBLIC_APP_URL) ||
        AdminUrlUtils.toNonEmptyString(process.env.APP_URL) ||
        AdminUrlUtils.inferFrontendBaseUrlFromBrowser() ||
        fallback;

      if (!raw) return fallback;
      if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/+$/, '');
      return `http://${raw.replace(/^\/+/, '').replace(/\/+$/, '')}`;

  }

  // ---------------------------------------------------------------------------
  // Private static helpers (implementation details — not part of public API)
  // ---------------------------------------------------------------------------

  private static toNonEmptyString(value: unknown): string {
    return String(value ?? '').trim();
  }

  private static inferFrontendBaseUrlFromBrowser(): string {
    if (typeof window === 'undefined') return '';
    const { protocol, hostname, port } = window.location;
    if (!hostname) return '';

    let resolvedHost = hostname;
    if (hostname.startsWith('admin.')) {
      resolvedHost = hostname.replace(/^admin\./, 'frontend.');
    } else if (hostname.startsWith('api.')) {
      resolvedHost = hostname.replace(/^api\./, 'frontend.');
    }

    const hostWithPort = port ? `${resolvedHost}:${port}` : resolvedHost;
    return `${protocol}//${hostWithPort}`.replace(/\/+$/, '');
  }
}