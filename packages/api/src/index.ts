import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { PluginManager, ThemeManager, Logger, requestContext, HotReloadService, RecordVersions } from '@fromcode/core';
import { AuthManager } from '@fromcode/auth';
import { MediaManager } from '@fromcode/media';
import { CacheFactory, CacheManager } from '@fromcode/cache';
import { systemSessions, eq, and, gt } from '@fromcode/database';
import * as path from 'path';
import * as fs from 'fs';
import { RESTController } from './controllers/RESTController';
import { API_ROUTES } from './constants';
import { setupAuthRoutes } from './routes/auth';
import { setupPluginRoutes, setupPluginAssetRoutes } from './routes/plugins';
import { setupThemeRoutes, setupThemeAssetRoutes } from './routes/themes';
import { setupSystemRoutes } from './routes/system';
import { setupMediaRoutes } from './routes/media';
import { setupCollectionRoutes, setupLegacyCollectionRoutes } from './routes/collections';
import { UserCollection, MediaCollection, SettingsCollection } from './collections/core';
import { generateOpenAPI } from './swagger';
import { createCollectionMiddleware } from './middlewares/collection';

export class APIServer {
  public app = express();
  public pluginRouter = express.Router();
  private logger = new Logger({ namespace: 'APIServer' });
  private restController: RESTController;
  private mediaManager!: MediaManager;
  private cache: CacheManager;
  private settingsCache: Map<string, string> = new Map();
  
  constructor(private manager: PluginManager, private themeManager: ThemeManager, private auth: AuthManager) {
    const cacheDriver = process.env.REDIS_URL ? 'redis' : 'memory';
    const driver = CacheFactory.create(cacheDriver, { url: process.env.REDIS_URL });
    this.cache = new CacheManager(driver);

    this.restController = new RESTController(
      (manager as any).db, 
      this.auth,
      async (key, value) => {
        this.logger.info(`Setting updated: ${key} = ${value}`);
        this.settingsCache.set(key, value);
        await this.cache.set(`system_setting:${key}`, value);
      }
    );
  }

  public async initialize() {
    this.logger.info('Initializing API Server infrastructure...');
    this.setupCors();
    this.app.set('trust proxy', 1);
    this.app.use(express.json());
    this.app.use(cookieParser());

    await this.setupSettingsSync();

    const limiter = rateLimit({
      windowMs: parseInt(this.settingsCache.get('rate_limit_window') || process.env.RATE_LIMIT_WINDOW_MS || '900000'),
      limit: (req) => {
        if (process.env.NODE_ENV === 'development') return 10000;
        return parseInt(this.settingsCache.get('rate_limit_max') || process.env.RATE_LIMIT_MAX || '100');
      },
      message: { error: 'Too many requests from this IP, please try again later' },
      skip: (req) => {
        return !!req.headers['x-skip-rate-limit'] && req.headers['x-skip-rate-limit'] === process.env.ADMIN_SECRET;
      }
    } as any);

    this.app.use('/api/', limiter);
    this.mediaManager = (this.manager as any).storage;
    const systemUploadDir = process.env.STORAGE_UPLOAD_DIR || path.resolve(process.cwd(), 'public/uploads');
    this.app.use('/uploads', express.static(systemUploadDir));
    this.setupAuthIntegration();
    this.registerCoreCollection('users', UserCollection);
    this.registerCoreCollection('media', MediaCollection);
    this.registerCoreCollection('settings', SettingsCollection);
    this.registerCoreCollection('_system_record_versions', RecordVersions);
    this.setupMiddleware();
    this.setupRoutes();
    this.logger.info('API Server initialized successfully.');
  }

  private async setupSettingsSync() {
    // Initial load - must be completed before server accepts requests
    await this.refreshSettingsCache();
    
    // Refresh every 5 minutes (production) or 10 seconds (development)
    const interval = process.env.NODE_ENV === 'development' ? 10 * 1000 : 5 * 60 * 1000;
    setInterval(() => {
      this.refreshSettingsCache().catch(err => this.logger.error('Background cache sync failed: ' + err));
    }, interval);
  }

  private async refreshSettingsCache() {
    try {
      const db = (this.manager as any).db;
      
      const rows = await db.find('_system_meta', {
        columns: {
          key: true,
          value: true,
          description: true,
          group: true
        }
      });
      if (rows.length > 0) {
        this.logger.debug(`Synced ${rows.length} settings from DB. First row keys: ${Object.keys(rows[0]).join(', ')}`);
      }
      this.logger.debug(`Synced ${rows.length} settings from DB: ${rows.map((r: any) => r.key || 'undefined').join(', ')}`);
      
      // Update the cache without clearing it to avoid race conditions 
      // where requests see an empty cache for a few milliseconds.
      for (const row of rows) {
        if (row.key) {
          this.settingsCache.set(row.key, row.value);
          // Sync to global cache
          await this.cache.set(`system_setting:${row.key}`, row.value);
        }
      }

      // Ensure default rate limits exist in DB if not present
      await this.ensureDefaultSettings();
    } catch (err) {
      this.logger.error('Failed to sync settings cache: ' + err);
    }
  }

  private async ensureDefaultSettings() {
    try {
      const db = (this.manager as any).db;
      
      const defaults = [
        { key: 'platform_name', value: 'Fromcode Core', description: 'The identity of your platform instance.', group: 'General' },
        { key: 'frontend_url', value: 'http://frontend.framework.local', description: 'The primary URL for your frontend application.', group: 'General' },
        { key: 'permalink_structure', value: '/:slug', description: 'The default URL structure for your content (e.g. /:year/:month/:slug)', group: 'General' },
        { key: 'maintenance_mode', value: 'false', description: 'Enable global maintenance mode (blocks non-admin API access)', group: 'System' },
        { key: 'rate_limit_max', value: '100', description: 'Maximum requests per window per IP', group: 'Security' },
        { key: 'rate_limit_window', value: '900000', description: 'Rate limit window in milliseconds (15min = 900000)', group: 'Security' },
        { key: 'two_factor_enabled', value: 'false', description: 'Enable two-factor authentication for admin accounts.', group: 'Security' },
        { key: 'email_notifications', value: 'true', description: 'Receive system alerts and audit snapshots via email.', group: 'Engagement' }
      ];

      for (const d of defaults) {
        const existing = await db.findOne('_system_meta', { key: d.key });
        if (!existing) {
          await db.insert('_system_meta', d);
          this.settingsCache.set(d.key, d.value);
          await this.cache.set(`system_setting:${d.key}`, d.value);
        } else {
          // Sync existing value to cache (existing is already selected with correct columns by findOne)
          if (existing.key) {
            this.settingsCache.set(existing.key, existing.value);
            await this.cache.set(`system_setting:${existing.key}`, existing.value);
          }
          
          // Only update if metadata actually changed to reduce DB churn
          if (existing.description !== d.description || existing.group !== d.group) {
            await db.update('_system_meta', { key: d.key }, { 
              description: d.description, 
              group: d.group 
            });
          }
        }
      }
    } catch (e) {
      this.logger.error('Failed to ensure default settings: ' + e);
    }
  }

  private setupCors() {
    const corsOptions: cors.CorsOptions = {
      origin: (origin, callback) => {
        // In development, handle wide-open CORS.
        const isDevelopment = process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() === 'development';
        if (!origin || isDevelopment) {
          return callback(null, true);
        }

        try {
          const url = new URL(origin);
          const hostname = url.hostname;
          
          const envAllowed = process.env.CORS_ALLOWED_DOMAINS 
            ? process.env.CORS_ALLOWED_DOMAINS.split(',').map(d => d.trim().toLowerCase())
            : [];
          
          const allowedDomains = [
            'localhost', 
            '127.0.0.1', 
            'fromcode.local', 
            'framework.local', 
            'api.framework.local',
            'admin.framework.local',
            ...envAllowed
          ];
          
          const isAllowed = allowedDomains.some(domain => {
            const lowHost = hostname.toLowerCase();
            const lowDomain = domain.toLowerCase();
            return lowHost === lowDomain || lowHost.endsWith(`.${lowDomain}`);
          });
          
          if (isAllowed) {
            callback(null, true);
          } else {
            this.logger.error(`CORS BLOCKED: Origin "${origin}" (hostname: "${hostname}") is not in whitelist: ${allowedDomains.join(', ')}`);
            callback(new Error('Not allowed by CORS'));
          }
        } catch (err) {
          this.logger.error(`CORS Error parsing origin "${origin}": ${err}`);
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Framework-Client'],
      exposedHeaders: ['X-Framework-Maintenance']
    };

    this.app.use(cors(corsOptions));

    // Explicitly handle OPTIONS for all routes to ensure preflights always pass
    this.app.options('*', cors(corsOptions) as any);
  }

  private setupAuthIntegration() {
    this.auth.setSessionValidator(async (jti) => {
      try {
        const db = (this.manager as any).db;
        const drizzle = db.drizzle;
        
        // Use the imported systemSessions schema for type-safety and correct mapping
        const results = await drizzle
          .select()
          .from(systemSessions)
          .where(eq(systemSessions.tokenId, jti))
          .limit(1);
        
        const session = results[0];
        
        if (!session) {
          this.logger.warn(`Session not found for JTI: ${jti}`);
          return false;
        }
        
        if (session.isRevoked) {
          this.logger.warn(`Session revoked for JTI: ${jti}`);
          return false;
        }

        if (!session.expiresAt) {
          this.logger.warn(`Session has no expiration for JTI: ${jti}`);
          return false;
        }
        
        const isValid = new Date(session.expiresAt) > new Date();
        if (!isValid) {
          this.logger.warn(`Session expired for JTI: ${jti} (Expired at: ${session.expiresAt})`);
        }
        return isValid;
      } catch (e) {
        this.logger.error(`Session validation error for JTI ${jti}: ${e}`);
        return false;
      }
    });

    // API Key Validator Placeholder
    this.auth.setApiKeyValidator(async (key) => {
        // In a real app, you'd check a table of API keys
        if (key === process.env.MASTER_API_KEY) {
            return { id: '0', email: 'system@fromcode.com', roles: ['admin'] };
        }
        return null;
    });
  }

  private async getMaintenanceStatus(): Promise<boolean> {
    try {
      // 1. Try Global Cache (Redis) first - Highest Authority
      let redisVal = await this.cache.get('system_setting:maintenance_mode');
      
      // 2. Fallback to Local Memory Map
      let memoryVal = this.settingsCache.get('maintenance_mode');

      let val = redisVal;
      if (val === null || val === undefined) val = memoryVal;

      // 3. Emergency DB Sync - only if both caches are empty
      if (val === null || val === undefined) {
        const db = (this.manager as any).db;
        const row = await db.findOne('_system_meta', { key: 'maintenance_mode' });
        if (row) {
          val = row.value;
          this.settingsCache.set('maintenance_mode', row.value);
          await this.cache.set('system_setting:maintenance_mode', row.value);
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
    this.app.use((req: any, res, next) => {
      const locale = req.query.locale || req.cookies?.fc_locale || 'en';
      req.locale = locale;
      requestContext.run({ locale }, () => next());
    });

    this.app.use(this.auth.middleware());

    // Maintenance Mode Check
    this.app.use(async (req: any, res, next) => {
      // ALWAYS allow preflight OPTIONS requests to pass through
      // This is essential for CORS to work when maintenance mode is ON
      if (req.method === 'OPTIONS') return next();

      const isMaintenance = await this.getMaintenanceStatus();
      
      if (!isMaintenance) return next();

      // ALWAYS set these headers if maintenance is ON (even for admins)
      res.setHeader('X-Framework-Maintenance', 'on');
      res.setHeader('Access-Control-Expose-Headers', 'X-Framework-Maintenance');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

      const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');

      // Public routes that are ALWAYS allowed (even in maintenance)
      // These are essential for the system to function or for admins to login.
      const isPublicSystemRoute = 
        req.path === '/api/health' || 
        req.path.endsWith('openapi.json') ||
        req.path.startsWith('/api/auth') || 
        req.path.startsWith('/api/v1/auth') ||
        req.path.endsWith('/system/i18n') ||
        req.path.startsWith('/plugins/');

      if (isAdmin) {
        this.logger.debug(`Maintenance: ADMIN BYPASS for ${req.path} (${req.user?.email})`);
        return next();
      }

      if (isPublicSystemRoute) {
        return next();
      }

      this.logger.warn(`Maintenance: BLOCKED request to ${req.path} from ${req.user?.email || 'Guest'}`);

      // If we got here, it's a non-admin, non-public route during maintenance
      // We must still ensure CORS headers are present if it's an API request
      if (req.headers.origin) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      res.status(503).json({
        error: 'Service Unavailable',
        message: 'System is currently undergoing maintenance. Please try again later.'
      });
    });

    this.app.use((req: any, res, next) => {
      const hasToken = !!(req.cookies?.fc_token || req.headers.authorization);
      const cookieCount = req.cookies ? Object.keys(req.cookies).length : 0;
      
      // Don't log for every health check or status call in debug to avoid noise
      const isNoise = req.url.includes('/health') || req.url.includes('/status');
      if (!isNoise) {
        this.logger.debug(`${req.method} ${req.url} - User: ${req.user ? req.user.email : 'None'} - HasToken: ${hasToken} - Cookies: ${JSON.stringify(req.cookies || {})}`);
      }
      
      if (!req.user && hasToken && !isNoise) {
        this.logger.warn(`Token present but user not authenticated for ${req.url}. Possibly expired or invalid format.`);
      }
      next();
    });
  }

  private setupRoutes() {
    // Dynamically load version from package.json if available
    let coreVersion = '0.1.0';
    try {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        coreVersion = pkg.version || coreVersion;
      }
    } catch (e) {}

    this.app.get('/api/health', async (req: any, res) => res.json({ 
      status: 'ok', 
      version: coreVersion,
      maintenance: await this.getMaintenanceStatus(),
      bypass: !!(req.user && req.user.roles && req.user.roles.includes('admin'))
    }));

    const apiVersion = process.env.API_VERSION_PREFIX || 'v1';
    const vPrefix = `/api/${apiVersion}`;
    
    // Mount OpenAPI at both the generic and versioned path
    const openApiHandler = (req: any, res: any) => res.json(generateOpenAPI(this.manager.getCollections()));
    this.app.get('/api/openapi.json', openApiHandler);
    this.app.get(`${vPrefix}/openapi.json`, openApiHandler);
    
    const vApi = express.Router();

    vApi.use('/auth', setupAuthRoutes(this.manager, this.auth));
    vApi.use('/plugins', setupPluginRoutes(this.manager, this.auth));
    vApi.use('/themes', setupThemeRoutes(this.themeManager, this.auth));
    vApi.use('/system', setupSystemRoutes(this.manager, this.themeManager, this.auth, this.restController));
    vApi.use('/media', setupMediaRoutes(this.manager, this.auth, this.mediaManager));
    
    // Add collections to versioned API
    vApi.use(setupCollectionRoutes(this.manager, this.restController));

    // Mount isolated plugin router
    vApi.use(this.pluginRouter);
    
    // Mount versioned API
    this.app.use(vPrefix, vApi);

    // Legacy support (to avoid breaking current admin)
    this.app.use('/api/auth', setupAuthRoutes(this.manager, this.auth));
    this.app.use('/api/plugins', setupPluginRoutes(this.manager, this.auth));
    this.app.use('/api/themes', setupThemeRoutes(this.themeManager, this.auth));
    this.app.use('/api/media', setupMediaRoutes(this.manager, this.auth, this.mediaManager));
    this.app.use('/api/system', setupSystemRoutes(this.manager, this.themeManager, this.auth, this.restController));
    
    // Mount assets at root
    this.app.use('/plugins', setupPluginAssetRoutes(this.manager));
    this.app.use('/themes', setupThemeAssetRoutes(this.themeManager));

    this.app.use(API_ROUTES.COLLECTIONS.BASE, setupLegacyCollectionRoutes(this.manager, this.restController));
  }

  private registerCoreCollection(slug: string, collection: any) {
    const existing = this.manager.getCollections().find(c => c.slug === slug);
    if (!existing) {
      (this.manager as any).registeredCollections.set(slug, { 
        collection, 
        pluginSlug: 'system' 
      });
    }
  }

  public setupPluginCollectionProxy() {
    this.logger.info('Setting up automated Plugin Collection Proxy routes...');
    const middleware = createCollectionMiddleware(this.manager);

    // Standard CRUD Fallbacks for plugins
    // Note: These will only be reached if the plugin didn't register a custom route for the same path
    this.pluginRouter.get('/:pluginSlug/:slug', middleware, (req: any, res) => this.restController.find(req.collection, req, res));
    this.pluginRouter.get('/:pluginSlug/:slug/:id', middleware, (req: any, res) => this.restController.findOne(req.collection, req, res));
    this.pluginRouter.post('/:pluginSlug/:slug', middleware, (req: any, res) => this.restController.create(req.collection, req, res));
    this.pluginRouter.put('/:pluginSlug/:slug/:id', middleware, (req: any, res) => this.restController.update(req.collection, req, res));
    this.pluginRouter.patch('/:pluginSlug/:slug/:id', middleware, (req: any, res) => this.restController.update(req.collection, req, res));
    this.pluginRouter.delete('/:pluginSlug/:slug/:id', middleware, (req: any, res) => this.restController.delete(req.collection, req, res));
  }

  start(port: number = 3000, host: string = '0.0.0.0') {
    this.app.listen(port, host, () => {
      this.logger.info(`Running on http://${host}:${port}`);
    });
  }
}

async function bootstrap() {
  process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
  });

  try {
    const manager = new PluginManager();
    
    // 1. Manager Initialization (DB/Migrations)
    try {
      console.log('Step 1: Initializing PluginManager (Database/Migrations)...');
      await manager.init();
    } catch (err) {
      console.error('FATAL: PluginManager init failed. This is usually due to missing DATABASE_URL or DB unavailability.', err);
      process.exit(1);
    }

    // 2. Theme Manager Initialization
    const themeManager = new ThemeManager((manager as any).db);
    try {
      console.log('Step 2: Initializing ThemeManager...');
      await themeManager.init();
    } catch (err) {
      console.error('ERROR: ThemeManager init failed. System may continue but themes will be unavailable.', err);
    }

    // 3. API Server Infrastructure
    const auth = new AuthManager();
    const server = new APIServer(manager, themeManager, auth);
    try {
      console.log('Step 3: Initializing API Server Infrastructure...');
      await server.initialize();
    } catch (err) {
      console.error('FATAL: API Server initialization failed.', err);
      process.exit(1);
    }

    // 4. Plugin Discovery & Core Setup
    manager.setAuth(auth);
    manager.setApiHost(server.pluginRouter);
    
    try {
      console.log('Step 4: Discovering Plugins...');
      await manager.discoverPlugins();
      server.setupPluginCollectionProxy();
    } catch (err) {
      console.error('ERROR: Initial plugin discovery failed. Check manifest files and permissions.', err);
    }

    // 5. Development Services
    if (process.env.NODE_ENV === 'development') {
      try {
        console.log('Step 5: Starting Hot Reload Service (Development Mode)...');
        const hotReload = new HotReloadService(manager, manager.pluginsRoot);
        hotReload.start();
      } catch (err) {
        console.warn('WARNING: Hot Reload Service failed to start:', err);
      }
    }

    // 6. Final Start
    const port = Number(process.env.PORT) || 3000;
    server.start(port);
    console.log(`Step 6: API Server listening on port ${port}`);
    
    manager.emit('system:ready', { timestamp: Date.now() });

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
      try {
        await manager.close();
      } catch (e) {
        console.error('Error during shutdown:', e);
      }
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('FATAL SYSTEM ERROR: API Server failed to bootstrap fundamentally.', err);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap().catch(err => {
    console.error('Unhandled exception during bootstrap execution:', err);
    process.exit(1);
  });
}

