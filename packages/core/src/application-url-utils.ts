import { UrlUtils } from './url-utils';

export class ApplicationUrlUtils {
  static readonly API_APP = 'api';

  static readonly ADMIN_APP = 'admin';

  static readonly FRONTEND_APP = 'frontend';

  static readonly LEGACY_PLATFORM_DOMAIN = 'framework.local';

  static readonly DOCKER_INTERNAL_API_BASE_URL = 'http://api:3000';

  static readonly LOCALHOST_PRIMARY_API_BASE_URL = 'http://localhost:3000';

  static readonly LOCALHOST_FALLBACK_API_BASE_URL = 'http://localhost:4000';

  static normalizeBaseUrlCandidate(
    value: unknown,
    options: { stripApiPath?: boolean } = {},
  ): string {
    const parsed = ApplicationUrlUtils.parseAbsoluteUrl(value);
    if (!parsed) {
      return '';
    }

    const pathname = options.stripApiPath
      ? ApplicationUrlUtils.stripApiPath(parsed.pathname || '')
      : (parsed.pathname || '');

    return UrlUtils.trimTrailingSlash(`${parsed.origin}${pathname}`);
  }

  static readEnvironmentBaseUrl(
    envKeys: string[],
    options: { stripApiPath?: boolean } = {},
  ): string {
    for (const envKey of envKeys) {
      const normalized = ApplicationUrlUtils.normalizeBaseUrlCandidate(process.env[envKey], options);
      if (normalized) {
        return normalized;
      }
    }

    return '';
  }

  static readAppBaseUrlFromEnvironment(app: string): string {
    const normalizedApp = String(app || '').trim().toLowerCase();
    if (normalizedApp === ApplicationUrlUtils.API_APP) {
      return ApplicationUrlUtils.readEnvironmentBaseUrl(['API_URL', 'NEXT_PUBLIC_API_URL'], { stripApiPath: true });
    }

    if (normalizedApp === ApplicationUrlUtils.ADMIN_APP) {
      return ApplicationUrlUtils.readEnvironmentBaseUrl(['ADMIN_URL']);
    }

    if (normalizedApp === ApplicationUrlUtils.FRONTEND_APP) {
      return ApplicationUrlUtils.readEnvironmentBaseUrl([
        'FRONTEND_URL',
        'NEXT_PUBLIC_SITE_URL',
        'PUBLIC_APP_URL',
        'APP_URL',
      ]);
    }

    return '';
  }

  static getServerApiBaseUrlCandidates(): string[] {
    const values = [
      ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP),
      ApplicationUrlUtils.DOCKER_INTERNAL_API_BASE_URL,
      ApplicationUrlUtils.LOCALHOST_PRIMARY_API_BASE_URL,
      ApplicationUrlUtils.LOCALHOST_FALLBACK_API_BASE_URL,
    ];

    return ApplicationUrlUtils.unique(values.map((value) => ApplicationUrlUtils.normalizeBaseUrlCandidate(value, { stripApiPath: true })));
  }

  static derivePlatformDomain(...values: Array<unknown>): string {
    for (const value of values) {
      const parsed = value instanceof URL ? value : ApplicationUrlUtils.parseAbsoluteUrl(value);
      if (!parsed) {
        continue;
      }

      const hostname = parsed.hostname.toLowerCase();
      if (ApplicationUrlUtils.isLoopbackCandidate(parsed)) {
        return hostname;
      }

      const role = ApplicationUrlUtils.detectHostRole(parsed);
      if (role && hostname.startsWith(`${role}.`)) {
        return hostname.slice(role.length + 1);
      }

      return hostname;
    }

    return '';
  }

  static isLegacyFrameworkUrlCandidate(value: unknown, roles: string[] = []): boolean {
    const parsed = value instanceof URL ? value : ApplicationUrlUtils.parseAbsoluteUrl(value);
    if (!parsed) {
      return false;
    }

    if (ApplicationUrlUtils.isLoopbackCandidate(parsed)) {
      return parsed.protocol === 'http:';
    }

    const role = ApplicationUrlUtils.detectHostRole(parsed);
    if (roles.length > 0 && (!role || !roles.includes(role))) {
      return false;
    }

    return ApplicationUrlUtils.derivePlatformDomain(parsed) === ApplicationUrlUtils.LEGACY_PLATFORM_DOMAIN;
  }

  static isLegacyPlatformDomain(value: unknown): boolean {
    return String(value ?? '').trim().toLowerCase() === ApplicationUrlUtils.LEGACY_PLATFORM_DOMAIN;
  }

  static inferBrowserBaseUrl(targetApp?: string): string {
    if (typeof window === 'undefined') {
      return '';
    }

    const currentBaseUrl = ApplicationUrlUtils.normalizeBaseUrlCandidate(window.location?.origin || '');
    if (!currentBaseUrl || !targetApp) {
      return currentBaseUrl;
    }

    if (ApplicationUrlUtils.isLoopbackCandidate(currentBaseUrl)) {
      return currentBaseUrl;
    }

    const parsed = ApplicationUrlUtils.parseAbsoluteUrl(currentBaseUrl);
    if (!parsed) {
      return currentBaseUrl;
    }

    const currentApp = ApplicationUrlUtils.detectHostRole(parsed);
    if (!currentApp || currentApp === targetApp) {
      return currentBaseUrl;
    }

    const nextHostname = parsed.hostname.replace(
      new RegExp(`^${currentApp}(?=\\.|$)`, 'i'),
      String(targetApp || '').trim().toLowerCase(),
    );
    if (!nextHostname || nextHostname === parsed.hostname) {
      return currentBaseUrl;
    }

    return UrlUtils.trimTrailingSlash(
      `${parsed.protocol}//${nextHostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname || ''}`,
    );
  }

  static detectHostRole(value: URL | unknown): string {
    const parsed = value instanceof URL ? value : ApplicationUrlUtils.parseAbsoluteUrl(value);
    if (!parsed) {
      return '';
    }

    const hostname = parsed.hostname.toLowerCase();
    for (const role of [
      ApplicationUrlUtils.ADMIN_APP,
      ApplicationUrlUtils.API_APP,
      ApplicationUrlUtils.FRONTEND_APP,
    ]) {
      if (hostname === role || hostname.startsWith(`${role}.`)) {
        return role;
      }
    }

    return '';
  }

  static hasHostRole(value: URL | unknown, role: string): boolean {
    return ApplicationUrlUtils.detectHostRole(value) === String(role || '').trim().toLowerCase();
  }

  static isLoopbackCandidate(value: URL | unknown): boolean {
    const parsed = value instanceof URL ? value : ApplicationUrlUtils.parseAbsoluteUrl(value);
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

  private static stripApiPath(value: string): string {
    return String(value || '')
      .replace(/\/+$/, '')
      .replace(/\/api\/v\d+$/i, '')
      .replace(/\/api$/i, '');
  }

  private static unique(values: string[]): string[] {
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