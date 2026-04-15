/** ServerMiddlewareSetup — configures Express middlewares. Extracted from APIServer (ARC-007). */

import express from 'express';
import { CookieConstants, Logger, PluginManager, RequestContextUtils } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { ApiConfig } from '../config/api-config';
import { RequestCookieService } from '../services/request/request-cookie-service';
import { RequestLocaleService } from '../services/request/request-locale-service';
import { PublicSystemRouteUtils } from '../utils/public-system-route-utils';

export class ServerMiddlewareSetup {
  private readonly requestCookies = new RequestCookieService();
  private readonly requestLocale = new RequestLocaleService();

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
      const locale = this.requestLocale.resolveRequestLocale(req);
      req.locale = locale;
      RequestContextUtils.storage.run({ locale }, () => next());
    });

    this.app.use(this.auth.middleware());

    // Dynamic post-auth plugin middlewares
    this.app.use((req, res, next) => this.manager.middlewares.dispatch('post_auth' as any, req, res, next));

    // Maintenance mode check
    this.app.use(async (req: any, res, next) => {
      if (req.method === 'OPTIONS') return next();
      const isMaintenance = await this.getMaintenanceStatus();
      if (!isMaintenance) return next();

      res.setHeader('X-Framework-Maintenance', 'on');
      res.setHeader('Access-Control-Expose-Headers', 'X-Framework-Maintenance');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

      const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');
      const isPublicSystemRoute = PublicSystemRouteUtils.isMaintenanceBypassPath(String(req.path || ''));

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
      const hasToken =
        this.requestCookies.hasCookie(req, CookieConstants.AUTH_TOKEN) ||
        this.requestCookies.hasCookie(req, CookieConstants.CLIENT_AUTH_TOKEN) ||
        Boolean(req.headers.authorization);
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
