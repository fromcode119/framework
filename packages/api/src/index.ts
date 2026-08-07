import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import * as http from 'http';
import { PluginManager, ThemeManager, Logger, RecordVersions, WebSocketManager } from '@fromcode119/core';
import { SystemConstants, ApplicationUrlUtils, EnvUtils, LocalizationUtils, NetworkAddressUtils, RouteConstants, AsyncRouteGuard } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { MediaManager } from '@fromcode119/media';
import { CacheFactory, CacheManager } from '@fromcode119/cache';
import { RESTController } from '@api/controllers/rest/rest-controller';
import { ApiConfig } from '@api/config/api-config';
import { CoreCollections } from '@api/collections/core';
import { CSRFMiddleware } from '@api/middlewares/csrf-middleware';
import { XSSMiddleware } from '@api/middlewares/xss-middleware';
import { ErrorResponseMiddleware } from '@api/middlewares/error-response-middleware';
import { RateLimitMiddleware } from '@api/middlewares/rate-limit-middleware';
import { SchedulerService } from '@fromcode119/scheduler';
import { GraphQLService } from '@api/services/graph-ql-service';
import { ApiBootstrapService, ServerCorsSetup, ServerAuthSetup, ServerMaintenanceService, ServerMiddlewareSetup, ServerRoutesSetup, ServerSettingsService, ServerUploadsConfigService } from '@api/server/index';
import { WebhookRouteUtils } from '@api/utils/webhook-route-utils';

export class APIServer {
  public app = express();
  public pluginRouter = express.Router();
  private logger = new Logger({ namespace: 'APIServer' });
  private restController: RESTController;
  private graphQLService: GraphQLService;
  private socket: WebSocketManager;
  private mediaManager!: MediaManager;
  private cache: CacheManager;
  private settingsCache: Map<string, string> = new Map();
  private scheduler: SchedulerService;
  private settingsInterval?: NodeJS.Timeout;
  private settingsService!: ServerSettingsService;
  private corsSetup!: ServerCorsSetup;
  private maintenanceService!: ServerMaintenanceService;
  private authSetup!: ServerAuthSetup;
  private middlewareSetup!: ServerMiddlewareSetup;
  private routesSetup!: ServerRoutesSetup;
  
  constructor(private manager: PluginManager, private themeManager: ThemeManager, private auth: AuthManager) {
    const cacheDriver = process.env.REDIS_URL ? 'redis' : 'memory';
    const driver = CacheFactory.create(cacheDriver, { url: process.env.REDIS_URL });
    this.cache = new CacheManager(driver);
    this.scheduler = manager.scheduler;

    this.restController = new RESTController(
      (manager as any).db, 
      this.auth,
      async (key, value) => {
        this.logger.info(`Setting updated: ${key} = ${value}`);
        this.settingsCache.set(key, value);
        await this.cache.set(`system_setting:${key}`, value);
      },
      manager.hooks,
      manager.audit
    );

    this.graphQLService = new GraphQLService(manager, this.restController);
    this.socket = new WebSocketManager(manager.hooks);

    this.settingsService = new ServerSettingsService((manager as any).db, this.cache, this.settingsCache, this.logger);
    this.corsSetup = new ServerCorsSetup(this.app, this.settingsCache, this.logger);
    this.maintenanceService = new ServerMaintenanceService(this.manager, this.cache, this.settingsCache, this.logger);
    this.authSetup = new ServerAuthSetup(this.auth, (manager as any).db, this.logger);
    this.middlewareSetup = new ServerMiddlewareSetup(
      this.app,
      this.auth,
      manager,
      () => this.maintenanceService.getStatus(),
      this.logger,
      () => this.settingsCache.get(SystemConstants.META_KEY.DEFAULT_LOCALE) || '',
    );
    this.routesSetup = new ServerRoutesSetup(this.app, this.pluginRouter, manager, themeManager, this.auth, null as any, this.restController, this.graphQLService, () => this.maintenanceService.getStatus(), this.logger);
  }

  public async initialize() {

    this.logger.info('Initializing API Server infrastructure...');
    
    // Support nested proxies (e.g. Traefik -> Nginx -> Node). In containerized deployments the reverse
    // proxy connects from a PRIVATE subnet address (compose/Coolify networks live in 172.16/12 etc.),
    // not loopback — trusting only 127.0.0.1 made req.ip resolve to the proxy for every request, so ALL
    // visitors shared a single anonymous rate-limit bucket (100 req/15min for the whole storefront).
    // Trusting loopback + RFC1918 ranges restores per-visitor IPs from the edge proxy's X-Forwarded-For.
    this.app.set('trust proxy', (ip: string) => {
      if (EnvUtils.isDevelopment()) return true;
      return NetworkAddressUtils.isPrivate(ip);
    });
    
    // Core settings must be synced BEFORE CORS and other middlewares to ensure they have access to latest config
    await this.setupSettingsSync();

    // Let ApplicationUrlUtils fall back to the DB-backed URL settings when the matching env
    // var is unset (env always wins), so a URL changed in admin Settings propagates to links,
    // emails and PDFs — not only to CORS. Reads the same sync settings cache CORS uses.
    ApplicationUrlUtils.registerAppUrlSettingsReader((app: string) => {
      if (app === ApplicationUrlUtils.ADMIN_APP) {
        return this.settingsCache.get(SystemConstants.META_KEY.ADMIN_URL) || null;
      }
      if (app === ApplicationUrlUtils.FRONTEND_APP) {
        return this.settingsCache.get(SystemConstants.META_KEY.FRONTEND_URL)
          || this.settingsCache.get(SystemConstants.META_KEY.SITE_URL)
          || null;
      }
      return null; // API base URL has no DB setting — env-only
    });

    this.corsSetup.setup();

    this.mediaManager = (this.manager as any).storage;
    if (!this.mediaManager) {
      this.logger.warn('Storage integration not initialized. Falling back to default LocalMediaManager.');
      const { StorageFactory } = require('@fromcode119/media');
      const fallback = ServerUploadsConfigService.resolve((this.manager as any).projectRoot || process.cwd(), undefined);
      this.mediaManager = new MediaManager(
        StorageFactory.create('local', { uploadDir: fallback.uploadDir, publicUrlBase: fallback.publicUrlBase })
      );
    }

    this.routesSetup = new ServerRoutesSetup(this.app, this.pluginRouter, this.manager, this.themeManager, this.auth, this.mediaManager, this.restController, this.graphQLService, () => this.maintenanceService.getStatus(), this.logger);

    const uploadsConfig = ServerUploadsConfigService.resolve((this.manager as any).projectRoot || process.cwd(), this.mediaManager);
    this.logger.info(`Serving static uploads from: ${uploadsConfig.uploadDir} at ${uploadsConfig.publicPath}`);
    const uploadsStaticOptions = {
      maxAge: '30d',
      // SVG is an active document format: serve it with an explicit type and a
      // CSP that blocks script/object/frame execution (defense in depth on top
      // of the upload-time MediaSvgSanitizer).
      setHeaders: (res: express.Response, filePath: string) => {
        if (filePath.toLowerCase().endsWith('.svg')) {
          res.setHeader('Content-Type', 'image/svg+xml');
          res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
        }
      },
    };
    this.app.use(uploadsConfig.publicPath, express.static(uploadsConfig.uploadDir, uploadsStaticOptions));
    if (uploadsConfig.publicPath !== ApiConfig.getInstance().storage.DEFAULT_PUBLIC_URL) {
      this.app.use(ApiConfig.getInstance().storage.DEFAULT_PUBLIC_URL, express.static(uploadsConfig.uploadDir, uploadsStaticOptions));
    }

    const jsonBodyLimit = process.env.API_JSON_BODY_LIMIT || '10mb';
    const formBodyLimit = process.env.API_FORM_BODY_LIMIT || jsonBodyLimit;
    this.app.use(express.json({
      limit: jsonBodyLimit,
      verify: (req: any, _res, buf, encoding) => {
        if (WebhookRouteUtils.isWebhookPath(String(req?.path || ''))) {
          // Keep the raw buffer untouched — Stripe (and any HMAC verifier) requires
          // the original bytes. The decoded string is provided as a convenience.
          req.rawBody = Buffer.from(buf);
          req.rawBodyString = buf.toString((encoding as BufferEncoding) || 'utf8');
        }
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: formBodyLimit }));
    this.app.use(new XSSMiddleware().middleware());
    this.app.use(cookieParser());
    this.app.use(new CSRFMiddleware().middleware());

    const apiConfig = ApiConfig.getInstance();
    // The limiter's buckets, budgets, window and bypass list all live in RateLimitMiddleware, which
    // reads the operator's Settings → Security values through the same settings cache the rest of the
    // server uses. This used to be a second, inline copy of that configuration — so a rule added to
    // one limiter silently did not apply to the other.
    this.app.use(`${apiConfig.prefixes.BASE}/`, new RateLimitMiddleware({}, this.settingsCache).middleware());

    this.setupAuthIntegration();
    await this.registerCoreCollection('users', CoreCollections.user);
    await this.registerCoreCollection('media', CoreCollections.media);
    await this.registerCoreCollection('settings', CoreCollections.settings);
    await this.registerCoreCollection('_system_record_versions', RecordVersions.collection);
    this.setupMiddleware();
    await this.setupRoutes();

    // Plugin handlers are guarded where they are registered (BaseRouter / context.api). Framework
    // handlers registered STRAIGHT onto the app — the maintenance gate, the health and ready probes,
    // the rate limiter — never pass through either, so sweep the app's own stack once, after every
    // route exists and before the error handler is attached. Anything already guarded is skipped.
    AsyncRouteGuard.wrapRouter(this.app as unknown as Router, 'framework');

    // Global Error Handler with CORS support. Every rejected route handler arrives here via
    // AsyncRouteGuard, which is what stops an async rejection from killing the process.
    this.app.use(new ErrorResponseMiddleware(this.logger).middleware());

    this.logger.info('API Server initialized successfully.');
  }

  public async shutdown() {
    this.logger.info('Shutting down API Server...');
    if (this.settingsInterval) {
      clearInterval(this.settingsInterval);
      this.settingsInterval = undefined;
    }
    await this.manager.shutdown();
    this.logger.info('API Server shut down complete.');
  }

  private async setupSettingsSync() {
    await this.settingsService.setupSettingsSync();
    this.settingsService.subscribeToSettingsChanges(this.manager.hooks);
    this.settingsInterval = (this.settingsService as any).settingsInterval;
    // Seed the i18n manager's default locale from the configured platform setting (admin Settings →
    // Localization) so server-rendered legal documents (invoices, payout statements) render in the
    // PLATFORM language rather than the env default — exposed to plugins via context.i18n.defaultLocale().
    const configuredLocale = LocalizationUtils.normalizeLocaleCode(
      this.settingsCache.get(SystemConstants.META_KEY.DEFAULT_LOCALE) || '', { short: true },
    );
    if (configuredLocale) this.manager.i18n.setLocale(configuredLocale);
  }

  private setupAuthIntegration() {
    this.authSetup.configure();
  }

  private setupMiddleware() {
    this.middlewareSetup.setup();
  }

  private async setupRoutes() {
    return this.routesSetup.setupRoutes();
  }

  private async registerCoreCollection(slug: string, collection: any) {
    return this.routesSetup.registerCoreCollection(slug, collection);
  }

  public setupPluginCollectionProxy() {
    return this.routesSetup.setupPluginCollectionProxy();
  }

  start(port: number = 3000, host: string = '0.0.0.0') {
    const server = http.createServer(this.app);
    const wss = this.socket.initialize(server);

    server.on('upgrade', (request, socket, head) => {
      // A malformed upgrade URL makes `new URL` throw, and an emitter callback has no caller to catch
      // it — that is an uncaughtException, i.e. the process, from an unauthenticated socket. A request
      // we cannot parse is a request we refuse.
      let pathname: string;
      try {
        pathname = new URL(request.url || '', `http://${host}:${port}`).pathname;
      } catch {
        socket.destroy();
        return;
      }

      if (pathname === RouteConstants.SEGMENTS.WEBSOCKET && wss) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    server.listen(port, host, () => {
      this.logger.info(`Running on http://${host}:${port}`);
    });
  }

  static async bootstrap(): Promise<void> {
    return new ApiBootstrapService().bootstrap(
      (manager, themeManager, auth) => new APIServer(manager, themeManager, auth),
    );
  }
}
