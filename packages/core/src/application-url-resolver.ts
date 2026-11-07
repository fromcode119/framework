import { UrlUtils } from '@core/utils/url-utils';

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

  /** Pass `null` to unregister — every public app URL then resolves to `''` (relative). */
  static registerAppUrlSettingsReader(reader: ((app: string) => string | null) | null): void {
    ApplicationUrlResolver.appUrlSettingsReader = reader;
    ApplicationUrlResolver.basePaths.clear();
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

  /**
   * An app's PUBLIC address — from admin Settings and nowhere else.
   *
   * A domain is never deployment configuration. An install is reached by its IP first; the setup
   * wizard records the address it was reached on, and every later change is made in Settings →
   * General. An environment variable used to be read as the fallback, which made a second, invisible
   * source of the same value: a domain change in the admin could be silently outranked by a value
   * nobody could see from the console. `''` means "not configured" and callers use a relative path.
   *
   * The name is kept for the extensions that already call it.
   */
  static readAppBaseUrlFromEnvironment(app: string): string {
    const normalizedApp = String(app || '').trim().toLowerCase();
    if (
      normalizedApp !== ApplicationUrlResolver.API_APP
      && normalizedApp !== ApplicationUrlResolver.ADMIN_APP
      && normalizedApp !== ApplicationUrlResolver.FRONTEND_APP
    ) {
      return '';
    }
    if (!ApplicationUrlResolver.appUrlSettingsReader) {
      return '';
    }
    return ApplicationUrlResolver.normalizeBaseUrlCandidate(
      ApplicationUrlResolver.appUrlSettingsReader(normalizedApp),
      { stripApiPath: normalizedApp === ApplicationUrlResolver.API_APP },
    );
  }

  /**
   * Deployment-internal address for an app — the `INTERNAL_*` environment variables only.
   *
   * These name a container (`http://api:3000`), never a domain, and they never consult the DB-backed
   * settings reader. See the public façade
   * {@link ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment} for why.
   */
  static readAppInternalBaseUrlFromEnvironment(app: string): string {
    const normalizedApp = String(app || '').trim().toLowerCase();

    let envKey: string;
    if (normalizedApp === ApplicationUrlResolver.API_APP) {
      envKey = 'INTERNAL_API_URL';
    } else if (normalizedApp === ApplicationUrlResolver.ADMIN_APP) {
      envKey = 'INTERNAL_ADMIN_URL';
    } else if (normalizedApp === ApplicationUrlResolver.FRONTEND_APP) {
      envKey = 'INTERNAL_FRONTEND_URL';
    } else {
      return '';
    }

    const options = { stripApiPath: normalizedApp === ApplicationUrlResolver.API_APP };
    const declared = ApplicationUrlResolver.readEnvironmentBaseUrl([envKey], options);
    if (declared || normalizedApp !== ApplicationUrlResolver.API_APP) return declared;
    return ApplicationUrlResolver.readLegacyInternalApiUrl(options);
  }

  /**
   * Containers created before `INTERNAL_API_URL` existed were told where their api is by `API_URL`,
   * and the updater carries a container's environment forward unchanged — so on an existing install
   * that is the ONLY address the admin and the storefront have for their api. Ignoring it left the
   * storefront with nothing but loopback guesses and took a shop down (0.2.532).
   *
   * Read strictly as that internal wiring: only a container service name (`http://api:3000`) or a
   * loopback/IP address is accepted. A domain in it (`https://shop.example.com/api`) is ignored — a
   * public address is set in Settings, never here.
   */
  private static readLegacyInternalApiUrl(options: { stripApiPath?: boolean }): string {
    const value = ApplicationUrlResolver.normalizeBaseUrlCandidate(process.env.API_URL, options);
    if (!value) return '';
    try {
      const host = new URL(value).hostname;
      const isServiceName = !host.includes('.');
      const isAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
      return isServiceName || isAddress ? value : '';
    } catch {
      return '';
    }
  }

  /**
   * Base paths already worked out, keyed by the configured URL they come from. Read on every request
   * (the api's route table, the request-surface checks), and each read parsed URLs: measured under
   * load, 12% of the api's CPU. Keyed by the value itself, so a URL changed in Settings is read afresh.
   */
  private static readonly basePaths = new Map<string, string>();

  /**
   * The path an app is mounted on (`/admin`, `/api`) — taken from its configured URL in Settings.
   *
   * The admin's build-time mount (`NEXT_PUBLIC_ADMIN_BASE_PATH`) is a PATH baked into the bundle, not a
   * domain, and stays the admin's fallback when no admin URL is configured yet.
   */
  static readAppBasePathFromEnvironment(app: string): string {
    const normalizedApp = String(app || '').trim().toLowerCase();
    const configured = ApplicationUrlResolver.appUrlSettingsReader?.(normalizedApp) ?? '';
    const key = `${normalizedApp}\u0000${configured}`;
    const known = ApplicationUrlResolver.basePaths.get(key);
    if (known !== undefined) return known;
    const value = ApplicationUrlResolver.computeAppBasePath(normalizedApp, configured);
    if (ApplicationUrlResolver.basePaths.size > 64) ApplicationUrlResolver.basePaths.clear();
    ApplicationUrlResolver.basePaths.set(key, value);
    return value;
  }

  private static computeAppBasePath(app: string, configured: string): string {
    // The api's mount is the same in every process — the gateway, the admin and the storefront cannot
    // read Settings, so a path taken from the configured api URL would differ between them.
    if (app === ApplicationUrlResolver.API_APP) {
      return ApplicationUrlResolver.defaultBasePathForApp(app);
    }

    if (app === ApplicationUrlResolver.ADMIN_APP) {
      const fromAdminUrl = ApplicationUrlResolver.deriveBasePathFromUrl(configured, '');
      if (fromAdminUrl) {
        return fromAdminUrl;
      }
      const env = typeof process !== 'undefined' && process?.env ? process.env : ({} as Record<string, string | undefined>);
      return ApplicationUrlResolver.normalizePathPrefix(env.NEXT_PUBLIC_ADMIN_BASE_PATH || '');
    }

    if (app === ApplicationUrlResolver.FRONTEND_APP) {
      return ApplicationUrlResolver.deriveBasePathFromUrl(configured, '');
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
