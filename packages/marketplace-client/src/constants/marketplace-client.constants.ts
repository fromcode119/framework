export class MarketplaceClientConstants {
  static readonly DEFAULT_MARKETPLACE_URL = 'https://marketplace.fromcode.com';
  static readonly DEFAULT_FETCH_TIMEOUT_MS = 3000;

  static get MARKETPLACE_ROUTE_PATH(): string {
    return MarketplaceClientConstants.readPathFromEnv(
      ['NEXT_PUBLIC_MARKETPLACE_API_ROUTE_PATH', 'MARKETPLACE_API_ROUTE_PATH'],
      '/plugins/marketplace',
    );
  }

  static get API_BASE_PATH(): string {
    return `${MarketplaceClientConstants.readApiRootPath()}/${MarketplaceClientConstants.readApiVersion()}${MarketplaceClientConstants.MARKETPLACE_ROUTE_PATH}`;
  }

  static get SUBMIT_PATH(): string {
    return MarketplaceClientConstants.readPathFromEnv(
      ['NEXT_PUBLIC_MARKETPLACE_SUBMIT_PATH', 'MARKETPLACE_SUBMIT_PATH'],
      '/submit',
    );
  }

  static get CATALOG_FILENAME(): string {
    return MarketplaceClientConstants.readValueFromEnv(
      ['NEXT_PUBLIC_MARKETPLACE_CATALOG_FILENAME', 'MARKETPLACE_CATALOG_FILENAME'],
      'marketplace.json',
    );
  }

  static get DEFAULT_MARKETPLACE_API_URL(): string {
    return `${MarketplaceClientConstants.DEFAULT_MARKETPLACE_URL}${MarketplaceClientConstants.API_BASE_PATH}`;
  }

  static get DEFAULT_MARKETPLACE_CATALOG_URL(): string {
    return `${MarketplaceClientConstants.DEFAULT_MARKETPLACE_API_URL}/${MarketplaceClientConstants.CATALOG_FILENAME}`;
  }

  private static readValueFromEnv(names: string[], fallback: string): string {
    const env = MarketplaceClientConstants.readEnvironmentRecord();
    if (!env) {
      return fallback;
    }

    for (const name of names) {
      const value = String(env[name] || '').trim();
      if (value) {
        return value;
      }
    }

    return fallback;
  }

  private static readPathFromEnv(names: string[], fallback: string): string {
    const value = MarketplaceClientConstants.readValueFromEnv(names, fallback).trim();
    if (!value) {
      return fallback;
    }

    const normalized = value.replace(/\/+$/, '');
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  private static normalizeVersion(value: string): string {
    const raw = String(value || '').trim().replace(/^\/?api\//i, '').replace(/^\/+/, '');
    if (!raw) {
      return 'v1';
    }

    return raw.startsWith('v') ? raw : `v${raw}`;
  }

  private static readApiRootPath(): string {
    return MarketplaceClientConstants.readPathFromEnv(
      ['NEXT_PUBLIC_API_BASE_PATH', 'API_BASE_PATH'],
      '/api',
    );
  }

  private static readApiVersion(): string {
    return MarketplaceClientConstants.normalizeVersion(
      MarketplaceClientConstants.readValueFromEnv(
        ['NEXT_PUBLIC_API_VERSION', 'API_VERSION_PREFIX', 'DEFAULT_API_VERSION'],
        'v1',
      ),
    );
  }

  private static readEnvironmentRecord(): Record<string, string> | null {
    const globalScope = globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    };

    const env = globalScope.process?.env;
    return env ? Object.fromEntries(Object.entries(env).map(([key, value]) => [key, String(value || '')])) : null;
  }
}
