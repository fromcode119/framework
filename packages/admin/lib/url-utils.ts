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
      const explicitValue = AdminUrlUtils.normalizeFrontendCandidate(explicit);
      const settingsFrontend = AdminUrlUtils.normalizeFrontendCandidate(settings?.frontend_url);
      const settingsSite = AdminUrlUtils.normalizeFrontendCandidate(settings?.site_url);
      const raw =
        explicitValue ||
        settingsFrontend ||
        settingsSite ||
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
    return window.location.origin.replace(/\/+$/, '');
  }

  private static normalizeFrontendCandidate(value: unknown): string {
    const raw = AdminUrlUtils.toNonEmptyString(value);
    if (!raw) return '';
    if (!raw.includes('localhost')) return raw;

    const inferred = AdminUrlUtils.inferFrontendBaseUrlFromBrowser();
    if (inferred.includes('frontend.framework.local')) {
      return '';
    }

    return raw;
  }
}
