import cors from 'cors';
import express from 'express';
import { ApplicationDomainSettingsUtils, ApplicationHostUtils, EnvUtils, Logger, SystemConstants, TenantResolverService } from '@fromcode119/core';

export class ServerCorsSetup {
  constructor(
    private app: express.Application,
    private settingsCache: Map<string, string>,
    private logger: Logger,
    // The database, so the allowlist can ask which hosts are SITES on this platform. Every site
    // answers on its own host and loads its theme bundle and fonts from the api — a cross-origin
    // request — so a platform that cannot name its own sites refuses all but the one `FRONTEND_URL`
    // happens to name. The page still server-renders, so it looks right and never hydrates.
    private db?: unknown,
  ) {}

  /**
   * Whether `hostname` is a site this platform serves.
   *
   * Reads the SHARED resolver, the same cached host map the request middleware routes by: one query
   * per invalidation, not one per request, and `TenantRegistryService` already invalidates it on
   * every create, update, delete and import — so a site added in the admin is accepted immediately,
   * with no restart.
   *
   * EXACT host match, never the suffix rule the configured domains use. This is a
   * `credentials: true` allowlist: a suffix match on a tenant host would hand every subdomain of a
   * customer's domain a cookie-bearing channel.
   */
  private async isSiteHost(hostname: string): Promise<boolean> {
    if (!this.db) return false;
    try {
      const tenant = await TenantResolverService.shared(this.db as any).resolveByHost(hostname);
      return Boolean(tenant?.isActive);
    } catch (error: unknown) {
      // Never let a lookup failure decide the allowlist: fail closed and say so.
      this.logger.error(`CORS tenant lookup failed for "${hostname}": ${String((error as Error)?.message ?? error)}`);
      return false;
    }
  }

  setup(): void {
    const corsOptions: cors.CorsOptions = {
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }

        // FAIL CLOSED. This is a `credentials: true` allowlist, so the relaxed branch below hands any
        // loopback / `*.local` / `*.test` origin a cookie-bearing cross-origin channel. The old
        // `process.env.NODE_ENV || 'development'` inverted that: an UNSET env var opted into the
        // relaxation. EnvUtils.isDevelopment() is the framework's env accessor and is false unless
        // NODE_ENV is explicitly `development`.
        const isDevelopment = EnvUtils.isDevelopment();

        try {
          const url = new URL(origin);
          const hostname = url.hostname;

          if (isDevelopment && ApplicationHostUtils.isLoopbackHostname(hostname)) {
            return callback(null, true);
          }

          if (isDevelopment && (hostname.endsWith('.local') || hostname.endsWith('.test'))) {
            return callback(null, true);
          }

          const allowedDomains = [
            ...ApplicationHostUtils.getLocalAllowedDomains(),
            ...ApplicationDomainSettingsUtils.collectAllowedDomains({
              envAllowedDomains: process.env.CORS_ALLOWED_DOMAINS,
              platformDomain: this.settingsCache.get(SystemConstants.META_KEY.PLATFORM_DOMAIN),
              siteUrl: this.settingsCache.get(SystemConstants.META_KEY.SITE_URL),
              frontendUrl: this.settingsCache.get(SystemConstants.META_KEY.FRONTEND_URL) || process.env.FRONTEND_URL,
              adminUrl: this.settingsCache.get(SystemConstants.META_KEY.ADMIN_URL) || process.env.ADMIN_URL,
              apiUrl: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL,
              domainAliases: this.settingsCache.get(SystemConstants.META_KEY.DOMAIN_ALIASES),
            }),
          ];

          const isAllowed = allowedDomains.some((domain) => {
            const lowHost = hostname.toLowerCase();
            const lowDomain = domain.toLowerCase();
            return lowHost === lowDomain || lowHost.endsWith(`.${lowDomain}`);
          });

          if (isAllowed) {
            return callback(null, true);
          }

          // Not a configured domain — but it may be one of this platform's own sites.
          void this.isSiteHost(hostname).then((isSite) => {
            if (isSite) return callback(null, true);
            this.logger.warn(
              `CORS BLOCKED: Origin "${origin}" (hostname: "${hostname}") is neither a site on this `
              + `platform nor in the whitelist: ${allowedDomains.join(', ')}`,
            );
            callback(new Error('Not allowed by CORS'));
          });
        } catch (err) {
          this.logger.error(`CORS Error parsing origin "${origin}": ${err}`);
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'X-Framework-Client',
        'X-CSRF-Token',
        'X-Reset-Context',
        'X-App-Locale',
        'Cache-Control',
        'Pragma',
      ],
      exposedHeaders: ['X-Framework-Maintenance', 'X-CSRF-Token', 'Content-Disposition'],
    };

    this.app.use(cors(corsOptions));
    this.app.options(/.*/, cors(corsOptions) as any);
  }
}
