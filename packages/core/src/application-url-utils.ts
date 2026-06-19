import { UrlUtils } from './url-utils';
import { ApplicationUrlResolver } from './application-url-resolver';

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
    return ApplicationUrlResolver.normalizeBaseUrlCandidate(value, options);
  }

  static readEnvironmentBaseUrl(
    envKeys: string[],
    options: { stripApiPath?: boolean } = {},
  ): string {
    return ApplicationUrlResolver.readEnvironmentBaseUrl(envKeys, options);
  }

  /** Wire the DB-backed app URL settings (env still wins — see readAppBaseUrlFromEnvironment). */
  static registerAppUrlSettingsReader(reader: (app: string) => string | null): void {
    ApplicationUrlResolver.registerAppUrlSettingsReader(reader);
  }

  /**
   * Resolves the configured base URL for an app, ALWAYS returning a clean base with NO
   * trailing slash, or '' when unresolved. Callers MUST NOT post-process the return (no
   * `.replace(/\/+$/, '')`, no manual slash-joining) — use {@link joinApiPath} to append a
   * path. The empty-string case is the deliberate "no URL configured" contract; callers fall
   * back to a relative path.
   */
  static readAppBaseUrlFromEnvironment(app: string): string {
    return ApplicationUrlResolver.readAppBaseUrlFromEnvironment(app);
  }

  /**
   * Joins a resolved app base URL with a path using exactly one slash between them, and
   * returns a leading-slash relative path when the base is empty (matching the framework's
   * "empty base = relative" contract). Pure and tiny — the canonical way to append a path to
   * any {@link readAppBaseUrlFromEnvironment} / {@link inferBrowserBaseUrl} return.
   *
   * @example
   * ApplicationUrlUtils.joinApiPath('https://api.example.com', 'v1/orders') // 'https://api.example.com/v1/orders'
   * ApplicationUrlUtils.joinApiPath('', '/v1/orders')                       // '/v1/orders'
   */
  static joinApiPath(base: string, path: string): string {
    const cleanBase = UrlUtils.trimTrailingSlash(String(base ?? '').trim());
    const cleanPath = String(path ?? '').trim().replace(/^\/+/, '');
    if (!cleanBase) {
      return `/${cleanPath}`;
    }
    return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
  }

  static readAppBasePathFromEnvironment(app: string): string {
    return ApplicationUrlResolver.readAppBasePathFromEnvironment(app);
  }

  static getServerApiBaseUrlCandidates(): string[] {
    const values = [
      ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP),
      ApplicationUrlUtils.DOCKER_INTERNAL_API_BASE_URL,
      ApplicationUrlUtils.LOCALHOST_PRIMARY_API_BASE_URL,
      ApplicationUrlUtils.LOCALHOST_FALLBACK_API_BASE_URL,
    ];

    return ApplicationUrlResolver.unique(values.map((value) => ApplicationUrlUtils.normalizeBaseUrlCandidate(value, { stripApiPath: true })));
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

  /**
   * Infers the browser-side base URL for an app, ALWAYS returning a clean base with NO
   * trailing slash, or '' (server/no-window or unresolved). Callers MUST NOT post-process the
   * return (no `.replace(/\/+$/, '')`, no manual slash-joining) — use {@link joinApiPath} to
   * append a path; an empty base is the deliberate "fall back to a relative URL" contract.
   */
  static inferBrowserBaseUrl(targetApp?: string): string {
    if (typeof window === 'undefined') {
      return '';
    }

    const currentBaseUrl = ApplicationUrlUtils.normalizeBaseUrlCandidate(window.location?.origin || '');
    if (!currentBaseUrl || !targetApp) {
      return UrlUtils.trimTrailingSlash(currentBaseUrl);
    }

    if (ApplicationUrlUtils.isLoopbackCandidate(currentBaseUrl)) {
      return UrlUtils.trimTrailingSlash(currentBaseUrl);
    }

    const parsed = ApplicationUrlUtils.parseAbsoluteUrl(currentBaseUrl);
    if (!parsed) {
      return UrlUtils.trimTrailingSlash(currentBaseUrl);
    }

    const currentApp = ApplicationUrlUtils.detectHostRole(parsed);
    if (!currentApp || currentApp === targetApp) {
      return UrlUtils.trimTrailingSlash(currentBaseUrl);
    }

    const nextHostname = parsed.hostname.replace(
      new RegExp(`^${currentApp}(?=\\.|$)`, 'i'),
      String(targetApp || '').trim().toLowerCase(),
    );
    if (!nextHostname || nextHostname === parsed.hostname) {
      return UrlUtils.trimTrailingSlash(currentBaseUrl);
    }

    return UrlUtils.trimTrailingSlash(
      `${parsed.protocol}//${nextHostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname || ''}`,
    );
  }

  static translateBaseUrlToApp(value: unknown, targetApp: string): string {
    const parsed = ApplicationUrlUtils.parseAbsoluteUrl(value);
    if (!parsed) {
      return '';
    }

    const normalizedTargetApp = String(targetApp || '').trim().toLowerCase();
    const normalizedBaseUrl = ApplicationUrlUtils.normalizeBaseUrlCandidate(parsed);
    if (!normalizedTargetApp || ApplicationUrlUtils.isLoopbackCandidate(parsed)) {
      return normalizedBaseUrl;
    }

    const currentApp = ApplicationUrlUtils.detectHostRole(parsed);
    if (!currentApp || currentApp === normalizedTargetApp) {
      return normalizedBaseUrl;
    }

    const nextHostname = parsed.hostname.replace(
      new RegExp(`^${currentApp}(?=\\.|$)`, 'i'),
      normalizedTargetApp,
    );
    if (!nextHostname || nextHostname === parsed.hostname) {
      return normalizedBaseUrl;
    }

    return UrlUtils.trimTrailingSlash(
      `${parsed.protocol}//${nextHostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname || ''}`,
    );
  }

  static detectHostRole(value: URL | unknown): string {
    return ApplicationUrlResolver.detectHostRole(value);
  }

  static hasHostRole(value: URL | unknown, role: string): boolean {
    return ApplicationUrlUtils.detectHostRole(value) === String(role || '').trim().toLowerCase();
  }

  static isLoopbackCandidate(value: URL | unknown): boolean {
    return ApplicationUrlResolver.isLoopbackCandidate(value);
  }

  static parseAbsoluteUrl(value: unknown): URL | null {
    return ApplicationUrlResolver.parseAbsoluteUrl(value);
  }

  static deriveBasePathFromUrl(value: unknown, defaultPath = ''): string {
    return ApplicationUrlResolver.deriveBasePathFromUrl(value, defaultPath);
  }

  static normalizePathPrefix(value: unknown): string {
    return ApplicationUrlResolver.normalizePathPrefix(value);
  }
}
