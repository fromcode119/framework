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
              apiUrl: this.settingsCache.get(SystemConstants.META_KEY.API_URL) || process.env.API_URL || process.env.NEXT_PUBLIC_API_URL,
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
        'X-Framework-Site',
        'X-CSRF-Token',
        'X-Reset-Context',
        'X-App-Locale',
        'Cache-Control',
        'Pragma',
      ],
      exposedHeaders: ['X-Framework-Maintenance', 'X-CSRF-Token', 'Content-Disposition'],
    };

    // SAME-ORIGIN FIRST, before the allow-list is consulted at all.
    //
    // The allow-list answers "which OTHER origins may call us with credentials". It was also, by
    // omission, the only thing that let an app call ITSELF: with no admin_url/frontend_url saved and
    // no env, the list is empty and the console's own POST to its own host is refused. That is the
    // state a deployment configured entirely from the admin starts in, and it is why this has to be
    // decided before the list rather than inside it.
    //
    // It is not a relaxation. A browser sets `Origin` from the page that initiated the request and a
    // cross-site page cannot forge it, so `Origin`'s host equalling the host this request was sent to
    // means the request came from a page on that same host — same-origin by definition, which needs
    // no CORS grant. `X-Forwarded-Host` is read first because that is the public host behind the
    // gateway (and what tenancy already routes by); it is not attacker-supplied, since a browser
    // will not let a cross-origin fetch set it without a preflight this server never approves.
    const delegate: cors.CorsOptionsDelegate = (req: any, callback: any) => {
      const origin = String(req?.headers?.origin || '');
      if (origin && ServerCorsSetup.isSameOrigin(origin, req)) {
        return callback(null, { ...corsOptions, origin: true });
      }
      return callback(null, corsOptions);
    };

    this.app.use(cors(delegate));
    this.app.options(/.*/, cors(delegate) as any);
  }

  /** Did this request come from a page on the very host it was sent to? Compared with the port. */
  private static isSameOrigin(origin: string, req: any): boolean {
    try {
      const originHost = new URL(origin).host.trim().toLowerCase();
      const forwarded = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
      const host = (forwarded || String(req?.headers?.host || '')).trim().toLowerCase();
      return Boolean(originHost) && originHost === host;
    } catch {
      return false;
    }
  }
}
