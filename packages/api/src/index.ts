import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import * as http from 'http';
import { 
  PluginManager, 
  ThemeManager, 
  Logger, 
  RecordVersions, 
  WebSocketManager, 
} from '@fromcode119/core';
import { SystemConstants, ApplicationUrlUtils, LocalizationUtils } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { MediaManager } from '@fromcode119/media';
import { CacheFactory, CacheManager } from '@fromcode119/cache';
import { RESTController } from './controllers/rest/rest-controller';
import { ApiConfig } from './config/api-config';
import { CoreCollections } from './collections/core';
import { CSRFMiddleware } from './middlewares/csrf-middleware';
import { XSSMiddleware } from './middlewares/xss-middleware';
import { SchedulerService } from '@fromcode119/scheduler';
import { GraphQLService } from './services/graph-ql-service';
import {
  ApiBootstrapService,
  ServerCorsSetup,
  ServerAuthSetup,
  ServerMaintenanceService,
  ServerMiddlewareSetup,
  ServerRoutesSetup,
  ServerSettingsService,
  ServerUploadsConfigService,
} from './server/index';
import { PublicSystemRouteUtils } from './utils/public-system-route-utils';
import { WebhookRouteUtils } from './utils/webhook-route-utils';
import { AdminBootstrapRateLimitUtils } from './utils/admin-bootstrap-rate-limit-utils';

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
      manager.hooks
    );

    this.graphQLService = new GraphQLService(manager, this.restController);
    this.socket = new WebSocketManager(manager.hooks);

    this.settingsService = new ServerSettingsService((manager as any).db, this.cache, this.settingsCache, this.logger);
    this.corsSetup = new ServerCorsSetup(this.app, this.settingsCache, this.logger);
    this.maintenanceService = new ServerMaintenanceService(this.manager, this.cache, this.settingsCache, this.logger);
    this.authSetup = new ServerAuthSetup(this.auth, (manager as any).db, this.logger);
    this.middlewareSetup = new ServerMiddlewareSetup(this.app, this.auth, manager, () => this.maintenanceService.getStatus(), this.logger);
    this.routesSetup = new ServerRoutesSetup(this.app, this.pluginRouter, manager, themeManager, this.auth, null as any, this.restController, this.graphQLService, () => this.maintenanceService.getStatus(), this.logger);
  }

  public async initialize() {
    this.logger.info('Initializing API Server infrastructure...');
    
    // Support nested proxies (e.g. Traefik -> Nginx -> Node)
    this.app.set('trust proxy', (ip: string) => {
      if (process.env.NODE_ENV === 'development') return true;
      return ip === '127.0.0.1' || ip === '::1';
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
    const limiter = rateLimit({
      windowMs: parseInt(this.settingsCache.get('rate_limit_window') || process.env.RATE_LIMIT_WINDOW_MS || '900000'),
      limit: (req) => {
        if (process.env.NODE_ENV === 'development') return 10000;
        return parseInt(this.settingsCache.get('rate_limit_max') || process.env.RATE_LIMIT_MAX || '100');
      },
      keyGenerator: (req) => AdminBootstrapRateLimitUtils.resolveKey(req),
      message: { error: 'Too many requests from this IP, please try again later' },
      skip: (req) => {
        if (PublicSystemRouteUtils.isRateLimitBypassPath(String(req.path || ''))) {
          return true;
        }

        return !!req.headers['x-skip-rate-limit'] && req.headers['x-skip-rate-limit'] === process.env.ADMIN_SECRET;
      }
    } as any);

    this.app.use(`${apiConfig.prefixes.BASE}/`, limiter);

    this.setupAuthIntegration();
    await this.registerCoreCollection('users', CoreCollections.user);
    await this.registerCoreCollection('media', CoreCollections.media);
    await this.registerCoreCollection('settings', CoreCollections.settings);
    await this.registerCoreCollection('_system_record_versions', RecordVersions.collection);
    this.setupMiddleware();
    await this.setupRoutes();

    // Global Error Handler with CORS support
    this.app.use((err: any, req: any, res: any, next: any) => {
      if (err?.status === 413 || err?.type === 'entity.too.large') {
        return res.status(413).json({
          error: 'Payload Too Large',
          message: 'Request body is too large. Reduce staged action payload size or increase API_JSON_BODY_LIMIT.',
        });
      }
      this.logger.error(`Unhandled Error: ${err.message}`, { stack: err.stack, path: req.path });
      
      // Ensure CORS headers even on error
      if (req.headers.origin) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Framework-Client, X-CSRF-Token, X-Reset-Context');
      }
      
      res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
      });
    });

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
      const pathname = new URL(request.url || '', `http://${host}:${port}`).pathname;

      if (pathname === '/socket' && wss) {
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
