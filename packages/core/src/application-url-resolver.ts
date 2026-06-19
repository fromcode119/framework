import { UrlUtils } from './url-utils';

/**
 * Internal resolution helpers for {@link ApplicationUrlUtils}. Not part of the
 * public surface — every method here is delegated to from the public static
 * façade so the returned URL/path values stay byte-for-byte identical.
 */
export class ApplicationUrlResolver {
  static readonly API_APP = 'api';

  static readonly ADMIN_APP = 'admin';

  static readonly FRONTEND_APP = 'frontend';

  private static appUrlSettingsReader: ((app: string) => string | null) | null = null;

  static registerAppUrlSettingsReader(reader: (app: string) => string | null): void {
    ApplicationUrlResolver.appUrlSettingsReader = reader;
  }

  static normalizeBaseUrlCandidate(
    value: unknown,
    options: { stripApiPath?: boolean } = {},
  ): string {
    const parsed = ApplicationUrlResolver.parseAbsoluteUrl(value);
    if (!parsed) {
      return '';
    }

    const pathname = options.stripApiPath
      ? ApplicationUrlResolver.stripApiPath(parsed.pathname || '')
      : (parsed.pathname || '');

    return UrlUtils.trimTrailingSlash(`${parsed.origin}${pathname}`);
  }

  static readEnvironmentBaseUrl(
    envKeys: string[],
    options: { stripApiPath?: boolean } = {},
  ): string {
    for (const envKey of envKeys) {
      const normalized = ApplicationUrlResolver.normalizeBaseUrlCandidate(process.env[envKey], options);
      if (normalized) {
        return normalized;
      }
    }

    return '';
  }

  static readAppBaseUrlFromEnvironment(app: string): string {
    const normalizedApp = String(app || '').trim().toLowerCase();

    let envKeys: string[];
    if (normalizedApp === ApplicationUrlResolver.API_APP) {
      envKeys = ['API_URL', 'NEXT_PUBLIC_API_URL'];
    } else if (normalizedApp === ApplicationUrlResolver.ADMIN_APP) {
      envKeys = ['ADMIN_URL'];
    } else if (normalizedApp === ApplicationUrlResolver.FRONTEND_APP) {
      envKeys = ['FRONTEND_URL', 'NEXT_PUBLIC_SITE_URL', 'PUBLIC_APP_URL', 'APP_URL'];
    } else {
      return '';
    }
    const stripApiPath = normalizedApp === ApplicationUrlResolver.API_APP;

    // Setting-first, matching how CORS already resolves these URLs: a value configured in
    // admin Settings is authoritative; the env var is the fallback when the setting is
    // empty. This keeps the admin UI meaningful (what you set takes effect) and consistent
    // across CORS, links, emails and PDFs.
    if (ApplicationUrlResolver.appUrlSettingsReader) {
      const fromSetting = ApplicationUrlResolver.normalizeBaseUrlCandidate(
        ApplicationUrlResolver.appUrlSettingsReader(normalizedApp),
        { stripApiPath },
      );
      if (fromSetting) {
        return UrlUtils.trimTrailingSlash(fromSetting);
      }
    }
    return UrlUtils.trimTrailingSlash(
      ApplicationUrlResolver.readEnvironmentBaseUrl(envKeys, { stripApiPath }),
    );
  }

  static readAppBasePathFromEnvironment(app: string): string {
    const normalizedApp = String(app || '').trim().toLowerCase();
    if (normalizedApp === ApplicationUrlResolver.API_APP) {
      return ApplicationUrlResolver.deriveBasePathFromUrl(
        process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '',
        ApplicationUrlResolver.defaultBasePathForApp(normalizedApp),
      );
    }

    if (normalizedApp === ApplicationUrlResolver.ADMIN_APP) {
      const fromAdminUrl = ApplicationUrlResolver.deriveBasePathFromUrl(
        process.env.ADMIN_URL || '',
        ApplicationUrlResolver.defaultBasePathForApp(normalizedApp),
      );
      if (fromAdminUrl) {
        return fromAdminUrl;
      }

      return ApplicationUrlResolver.normalizePathPrefix(process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || '');
    }

    if (normalizedApp === ApplicationUrlResolver.FRONTEND_APP) {
      return ApplicationUrlResolver.deriveBasePathFromUrl(
        process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || '',
        '',
      );
    }

    return '';
  }

  static detectHostRole(value: URL | unknown): string {
    const parsed = value instanceof URL ? value : ApplicationUrlResolver.parseAbsoluteUrl(value);
    if (!parsed) {
      return '';
    }

    const hostname = parsed.hostname.toLowerCase();
    for (const role of [
      ApplicationUrlResolver.ADMIN_APP,
      ApplicationUrlResolver.API_APP,
      ApplicationUrlResolver.FRONTEND_APP,
    ]) {
      if (hostname === role || hostname.startsWith(`${role}.`)) {
        return role;
      }
    }

    return '';
  }

  static isLoopbackCandidate(value: URL | unknown): boolean {
    const parsed = value instanceof URL ? value : ApplicationUrlResolver.parseAbsoluteUrl(value);
    if (!parsed) {
      return false;
    }

    return parsed.hostname === 'localhost'
      || parsed.hostname === '127.0.0.1'
      || parsed.hostname === '[::1]'
      || parsed.hostname === '::1';
  }

  static parseAbsoluteUrl(value: unknown): URL | null {
    const rawValue = String(value ?? '').trim();
    if (!rawValue || rawValue.startsWith('/')) {
      return null;
    }

    try {
      if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) {
        return new URL(rawValue);
      }

      return new URL(`http://${rawValue.replace(/^\/+/, '')}`);
    } catch {
      return null;
    }
  }

  static deriveBasePathFromUrl(value: unknown, defaultPath = ''): string {
    const parsed = ApplicationUrlResolver.parseAbsoluteUrl(value);
    if (!parsed) {
      return ApplicationUrlResolver.normalizePathPrefix(defaultPath);
    }

    const normalizedPath = ApplicationUrlResolver.normalizePathPrefix(parsed.pathname || '');
    if (!normalizedPath) {
      return ApplicationUrlResolver.normalizePathPrefix(defaultPath);
    }

    const withoutVersion = normalizedPath.replace(/\/v[^/]+$/i, '');
    return ApplicationUrlResolver.normalizePathPrefix(withoutVersion) || ApplicationUrlResolver.normalizePathPrefix(defaultPath);
  }

  static normalizePathPrefix(value: unknown): string {
    const rawValue = String(value ?? '').trim();
    if (!rawValue || rawValue === '/') {
      return '';
    }

    const withLeadingSlash = rawValue.startsWith('/') ? rawValue : `/${rawValue}`;
    return withLeadingSlash.replace(/\/+$/, '').replace(/\/{2,}/g, '/');
  }

  static defaultBasePathForApp(app: string): string {
    if (app === ApplicationUrlResolver.API_APP) {
      return '/api';
    }

    return '';
  }

  static stripApiPath(value: string): string {
    const normalizedValue = ApplicationUrlResolver.normalizePathPrefix(value);
    if (!normalizedValue) {
      return '';
    }

    const apiBasePath = ApplicationUrlResolver.deriveBasePathFromUrl(
      `http://placeholder${normalizedValue}`,
      '',
    );
    if (!apiBasePath) {
      return normalizedValue;
    }

    if (normalizedValue === apiBasePath) {
      return '';
    }

    if (normalizedValue.startsWith(`${apiBasePath}/`)) {
      return normalizedValue.slice(apiBasePath.length);
    }

    return normalizedValue;
  }

  static unique(values: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
      if (!value || seen.has(value)) {
        continue;
      }

      seen.add(value);
      output.push(value);
    }

    return output;
  }
}
