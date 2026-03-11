import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import * as http from 'http';
import dotenv from 'dotenv';
import { 
  PluginManager, 
  ThemeManager, 
  Logger, 
  RequestContextUtils,
  HotReloadService, 
  RecordVersions, 
  WebSocketManager, 
  EnvConfig,
  HookAdapterFactory,
  QueueAdapterFactory,
} from '@fromcode119/core';
import { SystemConstants } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { MediaManager } from '@fromcode119/media';
import { CacheFactory, CacheManager } from '@fromcode119/cache';
import { systemSessions, eq, and, gt } from '@fromcode119/database';
import * as path from 'path';
import * as fs from 'fs';
import { RESTController } from './controllers/rest-controller';
import { ApiConfig } from './config/api-config';
import { ApiUrlUtils } from './utils/url';
import { AuthRouter } from './routes/auth-router';
import { PluginAssetRouter } from './routes/plugin-asset-router';
import { PluginRouter } from './routes/plugin-router-class';
import { PluginSettingsRouter } from './routes/plugin-settings';
import { ThemeRouter } from './routes/theme-router-class';
import { ThemeAssetRouter } from './routes/theme-asset-router';
import { MarketplaceRouter } from './routes/marketplace';
import { SystemRouter } from './routes/system-router';
import { MediaRouter } from './routes/media-router';
import { VersioningRouter } from './routes/versioning';
import { CollectionRouter } from './routes/collection-router';
import { BaseCollectionRouter } from './routes/base-collection-router';
import { CoreCollections } from './collections/core';
import { SwaggerGenerator } from './swagger';
import { CollectionMiddleware } from './middlewares/collection-middleware';
import { CSRFMiddleware } from './middlewares/csrf-middleware';
import { XSSMiddleware } from './middlewares/xss-middleware';
import { SchedulerService } from '@fromcode119/scheduler';
import { GraphQLService } from './services/graph-ql-service';
import { createHandler } from 'graphql-http/lib/use/express';
import { createHash } from 'crypto';
import { ServerSettingsService } from './server-settings-service';
import { ServerAuthSetup } from './server-auth-setup';
import { ServerMiddlewareSetup } from './server-middleware-setup';
import { ServerRoutesSetup } from './server-routes-setup';

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

    // Initialize extracted services
    this.settingsService = new ServerSettingsService((manager as any).db, this.cache, this.settingsCache, this.logger);
    this.authSetup = new ServerAuthSetup(this.auth, (manager as any).db, this.logger);
    this.middlewareSetup = new ServerMiddlewareSetup(this.app, this.auth, manager, () => this.getMaintenanceStatus(), this.logger);
    this.routesSetup = new ServerRoutesSetup(this.app, this.pluginRouter, manager, themeManager, this.auth, null as any, this.restController, this.graphQLService, () => this.getMaintenanceStatus(), this.logger);
  }

  private resolveLocalUploadsConfig(mediaManager?: MediaManager): { uploadDir: string; publicUrlBase: string; publicPath: string } {
    const frameworkRoot = (this.manager as any).projectRoot || process.cwd();
    let uploadDir = process.env[ApiConfig.getInstance().storage.UPLOAD_DIR_ENV] || path.resolve(frameworkRoot, ApiConfig.getInstance().storage.DEFAULT_UPLOADS_SUBDIR);
    let publicUrlBase = ApiUrlUtils.resolveStoragePublicUrlBase(process.env[ApiConfig.getInstance().storage.PUBLIC_URL_ENV]);

    const driver: any = mediaManager?.driver;
    if (driver && String(driver.provider || '').trim().toLowerCase() === 'local') {
      const driverUploadDir = String(driver.uploadDir || '').trim();
      const driverPublicUrlBase = String(driver.publicUrlBase || '').trim();
      if (driverUploadDir) {
        uploadDir = path.isAbsolute(driverUploadDir)
          ? path.normalize(driverUploadDir)
          : path.resolve(frameworkRoot, driverUploadDir);
      }
      if (driverPublicUrlBase) {
        publicUrlBase = ApiUrlUtils.resolveStoragePublicUrlBase(driverPublicUrlBase);
      }
    }

    return {
      uploadDir,
      publicUrlBase,
      publicPath: ApiUrlUtils.resolveStoragePublicPath(publicUrlBase)
    };
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
    this.setupCors();

    this.mediaManager = (this.manager as any).storage;
    if (!this.mediaManager) {
      this.logger.warn('Storage integration not initialized. Falling back to default LocalMediaManager.');
      const { StorageFactory } = require('@fromcode119/media');
      const fallback = this.resolveLocalUploadsConfig(undefined);
      this.mediaManager = new MediaManager(
        StorageFactory.create('local', { uploadDir: fallback.uploadDir, publicUrlBase: fallback.publicUrlBase })
      );
    }

    // Update routesSetup with the actual mediaManager now that it's initialized
    this.routesSetup = new ServerRoutesSetup(this.app, this.pluginRouter, this.manager, this.themeManager, this.auth, this.mediaManager, this.restController, this.graphQLService, () => this.getMaintenanceStatus(), this.logger);

    // Serve static uploads BEFORE any auth/security middleware.
    // Must follow the active local storage config so saved files and served files share the same root.
    const uploadsConfig = this.resolveLocalUploadsConfig(this.mediaManager);
    this.logger.info(`Serving static uploads from: ${uploadsConfig.uploadDir} at ${uploadsConfig.publicPath}`);
    this.app.use(uploadsConfig.publicPath, express.static(uploadsConfig.uploadDir));
    if (uploadsConfig.publicPath !== ApiConfig.getInstance().storage.DEFAULT_PUBLIC_URL) {
      this.app.use(ApiConfig.getInstance().storage.DEFAULT_PUBLIC_URL, express.static(uploadsConfig.uploadDir));
    }

    const jsonBodyLimit = process.env.API_JSON_BODY_LIMIT || '10mb';
    const formBodyLimit = process.env.API_FORM_BODY_LIMIT || jsonBodyLimit;
    this.app.use(express.json({ limit: jsonBodyLimit }));
    this.app.use(express.urlencoded({ extended: true, limit: formBodyLimit }));
    this.app.use(new XSSMiddleware().middleware());
    this.app.use(cookieParser());
    this.app.use(new CSRFMiddleware().middleware());

    const limiter = rateLimit({
      windowMs: parseInt(this.settingsCache.get('rate_limit_window') || process.env.RATE_LIMIT_WINDOW_MS || '900000'),
      limit: (req) => {
        if (process.env.NODE_ENV === 'development') return 10000;
        return parseInt(this.settingsCache.get('rate_limit_max') || process.env.RATE_LIMIT_MAX || '100');
      },
      message: { error: 'Too many requests from this IP, please try again later' },
      skip: (req) => {
        // Skip rate limiting for EventSource (SSE) and health checks
        if (req.path.includes('/system/events') || req.path.includes('/health')) {
          return true;
        }
        return !!req.headers['x-skip-rate-limit'] && req.headers['x-skip-rate-limit'] === process.env.ADMIN_SECRET;
      }
    } as any);

    this.app.use(`${ApiConfig.getInstance().prefixes.BASE}/`, limiter);

    this.setupAuthIntegration();
    await this.registerCoreCollection('users', CoreCollections.user);
    await this.registerCoreCollection('media', CoreCollections.media);
    await this.registerCoreCollection('settings', CoreCollections.settings);
    await this.registerCoreCollection('_system_record_versions', RecordVersions);
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
    // Update settingsInterval reference for shutdown
    this.settingsInterval = (this.settingsService as any).settingsInterval;
  }

    private async refreshSettingsCache() {
    return this.settingsService.refreshSettingsCache();
  }

  private async ensureDefaultSettings() {
    return this.settingsService.ensureDefaultSettings();
  }

    private setupCors() {
    const corsOptions: cors.CorsOptions = {
      origin: (origin, callback) => {
        // If no origin, it's not a cross-origin request (like a local script or server-to-server)
        if (!origin) {
          return callback(null, true);
        }

        const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
        const isDevelopment = nodeEnv === 'development' || nodeEnv === 'dev' || nodeEnv === 'test';
        
        try {
          const url = new URL(origin);
          const hostname = url.hostname;
          
          // 1. Check development defaults
          if (isDevelopment) {
            if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local') || hostname.endsWith('.test')) {
              return callback(null, true);
            }
          }

          // 2. Build whitelist from environment and settings
          const envAllowed = process.env.CORS_ALLOWED_DOMAINS 
            ? process.env.CORS_ALLOWED_DOMAINS.split(',').map(d => d.trim().toLowerCase())
            : [];
          
          const allowedDomains = [
            'localhost', 
            '127.0.0.1', 
            ...envAllowed
          ];

          // Add platform core domains from settings
          const platformDomain = this.settingsCache.get(SystemConstants.META_KEY.PLATFORM_DOMAIN);
          const adminUrl = this.settingsCache.get(SystemConstants.META_KEY.ADMIN_URL);
          const frontendUrl = this.settingsCache.get(SystemConstants.META_KEY.FRONTEND_URL);

          if (platformDomain) allowedDomains.push(platformDomain);
          if (adminUrl) {
            try { allowedDomains.push(new URL(adminUrl).hostname); } catch(e) {}
          }
          if (frontendUrl) {
            try { allowedDomains.push(new URL(frontendUrl).hostname); } catch(e) {}
          }
          
          // 3. Validate hostname against whitelist (supports exact match or subdomains)
          const isAllowed = allowedDomains.some(domain => {
            const lowHost = hostname.toLowerCase();
            const lowDomain = domain.toLowerCase();
            return lowHost === lowDomain || lowHost.endsWith(`.${lowDomain}`);
          });
          
          if (isAllowed) {
            callback(null, true);
          } else {
            this.logger.warn(`CORS BLOCKED: Origin "${origin}" (hostname: "${hostname}") is not in whitelist: ${allowedDomains.join(', ')}`);
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
        'Pragma'
      ],
      exposedHeaders: ['X-Framework-Maintenance', 'X-CSRF-Token', 'Content-Disposition']
    };

    this.app.use(cors(corsOptions));

    // Explicitly handle OPTIONS for all routes to ensure preflights always pass
    this.app.options('*', cors(corsOptions) as any);
  }

  private setupAuthIntegration() {
    this.authSetup.configure();
  }

    private async getMaintenanceStatus(): Promise<boolean> {
    try {
      // 1. Try Global Cache (Redis) first - Highest Authority
      let redisVal = await this.cache.get(`system_setting:${SystemConstants.META_KEY.MAINTENANCE_MODE}`);
      
      // 2. Fallback to Local Memory Map
      let memoryVal = this.settingsCache.get(SystemConstants.META_KEY.MAINTENANCE_MODE);

      let val = redisVal;
      if (val === null || val === undefined) val = memoryVal;

      // 3. Emergency DB Sync - only if both caches are empty
      if (val === null || val === undefined) {
        const db = (this.manager as any).db;
        
        const hasMetaTable = await db.tableExists(SystemConstants.TABLE.META);
        if (!hasMetaTable) {
           return true; // Default ON if meta table is missing (fail-safe)
        }

        const row = await db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.MAINTENANCE_MODE });
        if (row) {
          val = row.value;
          this.settingsCache.set(SystemConstants.META_KEY.MAINTENANCE_MODE, row.value);
          await this.cache.set(`system_setting:${SystemConstants.META_KEY.MAINTENANCE_MODE}`, row.value);
        }
      }

      // If we found a value, return it
      if (val !== null && val !== undefined) {
        const isTrue = String(val).toLowerCase() === 'true';
        if (isTrue) {
          this.logger.debug(`Maintenance is ON (Redis: ${redisVal}, Memory: ${memoryVal}, Final: ${val})`);
        }
        return isTrue;
      }

      this.logger.warn('Could not determine maintenance status - failing closed (ON)');
      return true; 
    } catch (e) {
      this.logger.error('Error determining maintenance status - failing closed (ON):', e);
      return true;
    }
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
    dotenv.config();
    const manager = new PluginManager();

    // Create a dedicated Express Router BEFORE plugin discovery so that plugin onInit
    // hooks can call context.api.get/post/... and have their routes registered
    // immediately on this router.  The populated router is then mounted on
    // server.pluginRouter BEFORE server.initialize() registers the generic
    // /:pluginSlug/:slug catch-all routes, ensuring specific plugin routes win.
    const pluginApiRouter = express.Router();
    manager.setApiHost(pluginApiRouter);

    // Step 1: DB migrations, extensions, background workers (no plugin discovery).
    await manager.init();

    const themeManager = new ThemeManager((manager as any).db);
    await themeManager.init();
    const auth = new AuthManager(process.env.JWT_SECRET);
    manager.setAuth(auth);

    // Step 2: Discover and initialize plugins. Their onInit hooks register routes
    // on pluginApiRouter (apiHost) right now, before any catch-alls exist.
    try {
      await manager.discoverPlugins();
      try {
        await themeManager.ensureActiveThemeDependencies();
      } catch (err: any) {
        console.error('ERROR: Active theme dependency enforcement failed.', err);
      }
    } catch (err: any) {
      console.error('ERROR: Initial plugin discovery failed. Check manifest files and permissions.', err);
    }

    const server = new APIServer(manager, themeManager, auth);

    // Step 3: Mount the pre-populated plugin routes BEFORE server.initialize()
    // so specific routes take precedence over catch-alls.
    server.pluginRouter.use(pluginApiRouter);

    await server.initialize();

    // Step 4: Add collection catch-all routes AFTER specific plugin routes so they
    // only match paths that no plugin registered explicitly.
    server.setupPluginCollectionProxy();

    // Step 5: Hot reload in development.
    if (process.env.NODE_ENV === 'development') {
      try {
        const hotReload = new HotReloadService(manager, (manager as any).pluginsRoot);
        hotReload.start();
      } catch (err: any) {
        console.warn('WARNING: Hot Reload Service failed to start:', err);
      }
    }

    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';
    server.start(port, host);
  }
}

