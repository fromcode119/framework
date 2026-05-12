import cors from 'cors';
import express from 'express';
import {
  ApplicationDomainSettingsUtils,
  ApplicationHostUtils,
  Logger,
  SystemConstants,
} from '@fromcode119/core';

export class ServerCorsSetup {
  constructor(
    private app: express.Application,
    private settingsCache: Map<string, string>,
    private logger: Logger,
  ) {}

  setup(): void {
    const corsOptions: cors.CorsOptions = {
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }

        const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
        const isDevelopment = nodeEnv === 'development' || nodeEnv === 'dev' || nodeEnv === 'test';

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
            callback(null, true);
          } else {
            this.logger.warn(
              `CORS BLOCKED: Origin "${origin}" (hostname: "${hostname}") is not in whitelist: ${allowedDomains.join(', ')}`,
            );
            callback(new Error('Not allowed by CORS'));
          }
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
    this.app.options('*', cors(corsOptions) as any);
  }
}
