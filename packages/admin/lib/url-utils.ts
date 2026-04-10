import { ApiVersionUtils } from '@fromcode119/core/client';
import { ApplicationUrlUtils } from '../../core/src/application-url-utils';

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
  fallback: string = ''
): string {
      const explicitValue = AdminUrlUtils.normalizeFrontendCandidate(explicit);
      const settingsFrontend = AdminUrlUtils.normalizeFrontendCandidate(settings?.frontend_url);
      const settingsSite = AdminUrlUtils.normalizeFrontendCandidate(settings?.site_url);
      const fallbackValue = AdminUrlUtils.normalizeFrontendCandidate(fallback);
      const raw =
        explicitValue ||
        settingsFrontend ||
        settingsSite ||
        AdminUrlUtils.toNonEmptyString(process.env.FRONTEND_URL) ||
        AdminUrlUtils.toNonEmptyString(process.env.NEXT_PUBLIC_SITE_URL) ||
        AdminUrlUtils.toNonEmptyString(process.env.PUBLIC_APP_URL) ||
        AdminUrlUtils.toNonEmptyString(process.env.APP_URL) ||
        ApplicationUrlUtils.inferBrowserBaseUrl(ApplicationUrlUtils.FRONTEND_APP) ||
        fallbackValue;

      if (!raw) return '';
      if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/+$/, '');
      return `http://${raw.replace(/^\/+/, '').replace(/\/+$/, '')}`;

  }

  // ---------------------------------------------------------------------------
  // Private static helpers (implementation details — not part of public API)
  // ---------------------------------------------------------------------------

  private static toNonEmptyString(value: unknown): string {
    return String(value ?? '').trim();
  }
  private static normalizeFrontendCandidate(value: unknown): string {
    const raw = AdminUrlUtils.toNonEmptyString(value);
    if (!raw) return '';
    if (!ApplicationUrlUtils.isLoopbackCandidate(raw)) return raw;

    const inferred = ApplicationUrlUtils.inferBrowserBaseUrl(ApplicationUrlUtils.FRONTEND_APP);
    if (inferred && !ApplicationUrlUtils.isLoopbackCandidate(inferred)) {
      return '';
    }

    return raw;
  }
}
