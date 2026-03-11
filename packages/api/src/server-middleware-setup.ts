/** ServerMiddlewareSetup — configures Express middlewares. Extracted from APIServer (ARC-007). */

import express from 'express';
import { Logger, PluginManager, RequestContextUtils } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { ApiConfig } from './config/api-config';

export class ServerMiddlewareSetup {
  constructor(
    private readonly app: express.Application,
    private readonly auth: AuthManager,
    private readonly manager: PluginManager,
    private readonly getMaintenanceStatus: () => Promise<boolean>,
    private readonly logger: Logger,
  ) {}

  setup() {
    // Dynamic pre-auth plugin middlewares
    this.app.use((req, res, next) => this.manager.middlewares.dispatch('pre_auth' as any, req, res, next));

    this.app.use((req: any, res, next) => {
      const locale = req.query.locale || req.cookies?.fc_locale || 'en';
      req.locale = locale;
      RequestContextUtils.storage.run({ locale }, () => next());
    });

    this.app.use(this.auth.middleware());

    // Dynamic post-auth plugin middlewares
    this.app.use((req, res, next) => this.manager.middlewares.dispatch('post_auth' as any, req, res, next));

    // Maintenance mode check
    this.app.use(async (req: any, res, next) => {
      const probeRoutes = ApiConfig.getInstance().probeRoutes;
      if (req.method === 'OPTIONS') return next();
      const isMaintenance = await this.getMaintenanceStatus();
      if (!isMaintenance) return next();

      res.setHeader('X-Framework-Maintenance', 'on');
      res.setHeader('Access-Control-Expose-Headers', 'X-Framework-Maintenance');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

      const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');
      const isPublicSystemRoute =
        req.path === probeRoutes.HEALTH ||
        req.path === probeRoutes.READY ||
        req.path === ApiConfig.getInstance().legacyRoutes.system.HEALTH ||
        req.path === ApiConfig.getInstance().routes.system.HEALTH ||
        req.path === ApiConfig.getInstance().legacyRoutes.system.OPENAPI ||
        req.path === ApiConfig.getInstance().routes.system.OPENAPI ||
        req.path.startsWith(`${ApiConfig.getInstance().prefixes.BASE}/auth`) ||
        req.path.startsWith(`${ApiConfig.getInstance().prefixes.VERSIONED}/auth`) ||
        req.path === ApiConfig.getInstance().routes.system.I18N ||
        req.path === ApiConfig.getInstance().routes.system.EVENTS ||
        req.path.startsWith(ApiConfig.getInstance().publicRoutePrefixes.PLUGIN_ASSETS);

      if (isAdmin) { this.logger.debug(`Maintenance: ADMIN BYPASS for ${req.path} (${req.user?.email})`); return next(); }
      if (isPublicSystemRoute) return next();

      this.logger.warn(`Maintenance: BLOCKED request to ${req.path} from ${req.user?.email || 'Guest'}`);
      if (req.headers.origin) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Framework-Client, X-CSRF-Token, X-Reset-Context');
      }
      res.status(503).json({ error: 'Service Unavailable', message: 'System is currently undergoing maintenance. Please try again later.' });
    });

    // Dynamic pre-routing plugin middlewares
    this.app.use((req, res, next) => this.manager.middlewares.dispatch('pre_routing' as any, req, res, next));

    this.app.use((req: any, res, next) => {
      const probeRoutes = ApiConfig.getInstance().probeRoutes;
      const hasToken = !!(req.cookies?.fc_token || req.headers.authorization);
      const isNoise =
        req.url.includes(probeRoutes.HEALTH) ||
        req.url.includes(probeRoutes.READY) ||
        req.url.includes(ApiConfig.getInstance().routes.system.HEALTH) ||
        req.url.includes(ApiConfig.getInstance().routes.system.STATUS);
      if (!isNoise) this.logger.debug(`${req.method} ${req.url} - User: ${req.user ? req.user.email : 'None'} - HasToken: ${hasToken} - Cookies: ${JSON.stringify(req.cookies || {})}`);
      if (!req.user && hasToken && !isNoise) this.logger.warn(`Token present but user not authenticated for ${req.url}. Possibly expired or invalid format.`);
      next();
    });
  }
}
