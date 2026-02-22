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
  requestContext, 
  HotReloadService, 
  RecordVersions, 
  WebSocketManager, 
  validateEnv,
  HookAdapterFactory,
  QueueAdapterFactory
} from '@fromcode/core';
import { AuthManager } from '@fromcode/auth';
import { MediaManager } from '@fromcode/media';
import { CacheFactory, CacheManager } from '@fromcode/cache';
import { systemSessions, eq, and, gt } from '@fromcode/database';
import * as path from 'path';
import * as fs from 'fs';
import { RESTController } from './controllers/rest-controller';
import {
  API_PREFIXES,
  API_ROUTES,
  LEGACY_API_ROUTES,
  PUBLIC_ROUTE_PREFIXES,
  STORAGE_CONFIG,
  resolveStoragePublicUrl
} from './constants';
import { setupAuthRoutes } from './routes/auth';
import { setupPluginRoutes, setupPluginAssetRoutes } from './routes/plugins';
import { setupPluginSettingsRoutes } from './routes/plugin-settings';
import { setupThemeRoutes, setupThemeAssetRoutes } from './routes/themes';
import { setupMarketplaceRoutes } from './routes/marketplace';
import { setupSystemRoutes } from './routes/system';
import { setupMediaRoutes } from './routes/media';
import { setupVersioningRoutes } from './routes/versioning';
import { setupCollectionRoutes, setupBaseCollectionRoutes } from './routes/collections';
import { UserCollection, MediaCollection, SettingsCollection } from './collections/core';
import { generateOpenAPI } from './swagger';
import { createCollectionMiddleware } from './middlewares/collection';
import { csrfMiddleware, xssMiddleware } from './middlewares/security';
import { SchedulerService } from '@fromcode/scheduler';
import { GraphQLService } from './services/graph-ql-service';
import { createHandler } from 'graphql-http/lib/use/express';
import { createHash } from 'crypto';

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
  }

  public async initialize() {
    this.logger.info('Initializing API Server infrastructure...');
    this.setupCors();
    
    // Support nested proxies (e.g. Traefik -> Nginx -> Node)
    this.app.set('trust proxy', (ip: string) => {
      if (process.env.NODE_ENV === 'development') return true;
      return ip === '127.0.0.1' || ip === '::1';
    });

    // Serve static uploads BEFORE any auth/security middleware
    // This ensures public files are accessible without CSRF tokens or authentication
    const frameworkRoot = (this.manager as any).projectRoot || process.cwd();
    const systemUploadDir = process.env[STORAGE_CONFIG.UPLOAD_DIR_ENV] || path.resolve(frameworkRoot, STORAGE_CONFIG.DEFAULT_UPLOADS_SUBDIR);
    const publicUrl = resolveStoragePublicUrl(process.env[STORAGE_CONFIG.PUBLIC_URL_ENV]);
    
    this.logger.info(`Serving static uploads from: ${systemUploadDir} at ${publicUrl}`);
    this.app.use(STORAGE_CONFIG.DEFAULT_PUBLIC_URL, express.static(systemUploadDir));
    if (publicUrl !== STORAGE_CONFIG.DEFAULT_PUBLIC_URL) {
      this.app.use(publicUrl, express.static(systemUploadDir));
    }

    this.app.use(express.json());
    this.app.use(xssMiddleware);
    this.app.use(cookieParser());
    this.app.use(csrfMiddleware);

    await this.setupSettingsSync();

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

    this.app.use(`${API_PREFIXES.BASE}/`, limiter);
    this.mediaManager = (this.manager as any).storage;
    
    if (!this.mediaManager) {
      this.logger.warn('Storage integration not initialized. Falling back to default LocalMediaManager.');
      const { StorageFactory } = require('@fromcode/media');
      const frameworkRoot = (this.manager as any).projectRoot || process.cwd();
      const systemUploadDir = process.env[STORAGE_CONFIG.UPLOAD_DIR_ENV] || path.resolve(frameworkRoot, STORAGE_CONFIG.DEFAULT_UPLOADS_SUBDIR);
      const publicUrl = resolveStoragePublicUrl(process.env[STORAGE_CONFIG.PUBLIC_URL_ENV]);
      this.mediaManager = new MediaManager(StorageFactory.create('local', { uploadDir: systemUploadDir, publicUrlBase: publicUrl }));
    }

    this.setupAuthIntegration();
    this.registerCoreCollection('users', UserCollection);
    this.registerCoreCollection('media', MediaCollection);
    this.registerCoreCollection('settings', SettingsCollection);
    this.registerCoreCollection('_system_record_versions', RecordVersions);
    this.setupMiddleware();
    this.setupRoutes();

    // Global Error Handler with CORS support
    this.app.use((err: any, req: any, res: any, next: any) => {
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
      
      if (rows && rows.length > 0) {
        if (rows[0]) {
          this.logger.debug(`Synced ${rows.length} settings from DB. First row keys: ${Object.keys(rows[0]).join(', ')}`);
        }
        this.logger.debug(`Synced ${rows.length} settings from DB: ${rows.map((r: any) => r?.key || 'undefined').join(', ')}`);
      }
      
      // Update the cache without clearing it to avoid race conditions 
      // where requests see an empty cache for a few milliseconds.
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (row && row.key) {
            this.settingsCache.set(row.key, row.value);
            // Sync to global cache
            await this.cache.set(`system_setting:${row.key}`, row.value);
          }
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
        { key: 'timezone', value: 'UTC', description: 'Default system timezone for scheduling and display.', group: 'General' },
        { key: 'routing_home_target', value: 'auto', description: 'Homepage route target. Examples: auto, layout:<name>, collection:<slug>:<id>', group: 'Routing' },
        { key: 'permalink_structure', value: '/:slug', description: 'The default URL structure for your content (e.g. /:year/:month/:slug)', group: 'General' },
        { key: 'maintenance_mode', value: 'false', description: 'Enable global maintenance mode (blocks non-admin API access)', group: 'Settings' },
        { key: 'rate_limit_max', value: '100', description: 'Maximum requests per window per IP', group: 'security' },
        { key: 'rate_limit_window', value: '900000', description: 'Rate limit window in milliseconds (15min = 900000)', group: 'security' },
        { key: 'auth_session_duration_minutes', value: '10080', description: 'Login session duration in minutes for access token/cookie/session expiry.', group: 'security' },
        { key: 'auth_password_min_length', value: '8', description: 'Minimum required password length.', group: 'security' },
        { key: 'auth_password_require_uppercase', value: 'true', description: 'Require uppercase letters in passwords.', group: 'security' },
        { key: 'auth_password_require_lowercase', value: 'true', description: 'Require lowercase letters in passwords.', group: 'security' },
        { key: 'auth_password_require_number', value: 'true', description: 'Require digits in passwords.', group: 'security' },
        { key: 'auth_password_require_symbol', value: 'false', description: 'Require symbols in passwords.', group: 'security' },
        { key: 'auth_password_history', value: '5', description: 'Prevent reuse of the last N passwords.', group: 'security' },
        { key: 'auth_password_breach_check', value: 'false', description: 'Enable optional breach-check hook for passwords.', group: 'security' },
        { key: 'auth_password_reset_token_minutes', value: '30', description: 'Password reset token lifetime in minutes.', group: 'security' },
        { key: 'auth_email_change_token_minutes', value: '60', description: 'Email change token lifetime in minutes.', group: 'security' },
        { key: 'auth_lockout_threshold', value: '5', description: 'Failed login attempts before temporary lockout.', group: 'security' },
        { key: 'auth_lockout_window_minutes', value: '15', description: 'Window in minutes for counting failed logins.', group: 'security' },
        { key: 'auth_lockout_duration_minutes', value: '30', description: 'Lockout duration in minutes after threshold is reached.', group: 'security' },
        { key: 'auth_captcha_enabled', value: 'false', description: 'Require captcha after repeated login failures.', group: 'security' },
        { key: 'auth_captcha_threshold', value: '3', description: 'Failed attempts before captcha is required.', group: 'security' },
        { key: 'auth_security_notifications', value: 'true', description: 'Send user-facing security notification emails for auth events.', group: 'security' },
        { key: 'two_factor_enabled', value: 'false', description: 'Enable two-factor authentication for admin accounts.', group: 'security' },
        { key: 'localization_locales', value: '[{"code":"en","name":"English","enabled":true}]', description: 'JSON array of available locales with code, name and enabled state.', group: 'Localization' },
        { key: 'enabled_locales', value: 'en', description: 'Comma-separated list of enabled locale codes for compatibility layers.', group: 'Localization' },
        { key: 'default_locale', value: 'en', description: 'Default locale for system-level operations.', group: 'Localization' },
        { key: 'admin_default_locale', value: 'en', description: 'Default language for the admin interface.', group: 'Localization' },
        { key: 'frontend_default_locale', value: 'en', description: 'Default language for public frontend rendering.', group: 'Localization' },
        { key: 'locale_url_strategy', value: 'query', description: 'Locale URL strategy for frontend routes: query, path, or none.', group: 'Localization' },
        { key: 'frontend_auth_enabled', value: 'true', description: 'Enable customer-facing authentication flows on the frontend (register, verify, forgot/reset password).', group: 'security' },
        { key: 'frontend_registration_enabled', value: 'true', description: 'Allow new customer self-registration on the frontend.', group: 'security' },
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
        const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
        const isDevelopment = nodeEnv === 'development' || nodeEnv === 'dev' || nodeEnv === 'test';
        
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
            'frontend.framework.local',
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
    // Initialize Permission Checker
    const db = (this.manager as any).db;
    const { UserPermissionChecker } = require('@fromcode/auth');
    const permissionChecker = new UserPermissionChecker(db);
    this.auth.setPermissionChecker(permissionChecker);
    this.logger.info('Permission checker initialized and configured');

    this.auth.setSessionValidator(async (jti) => {
      try {
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

    // API key validator: supports master key and user-generated personal API tokens.
    this.auth.setApiKeyValidator(async (key) => {
      if (!key) return null;
      const rawKey = String(key || '').trim();
      if (!rawKey) return null;

      if (rawKey === process.env.MASTER_API_KEY) {
        return { id: '0', email: 'system@fromcode.com', roles: ['admin'] };
      }

      try {
        const keyHash = createHash('sha256').update(rawKey).digest('hex');
        const lookupRow = await db.findOne('_system_meta', { key: `auth:api_token:${keyHash}` });
        if (!lookupRow?.value) return null;

        let payload: any = null;
        try {
          payload = JSON.parse(String(lookupRow.value));
        } catch {
          return null;
        }

        const userId = Number(payload?.userId || 0);
        const tokenId = String(payload?.tokenId || '').trim();
        if (!userId || !tokenId) return null;

        const expiresAt = payload?.expiresAt ? new Date(String(payload.expiresAt)) : null;
        if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
          return null;
        }

        const user = await db.findOne('users', { id: userId });
        if (!user) return null;

        const roles = Array.isArray(user.roles)
          ? user.roles
          : (typeof user.roles === 'string'
              ? (() => {
                  try {
                    const parsed = JSON.parse(user.roles);
                    return Array.isArray(parsed) ? parsed : [];
                  } catch {
                    return [];
                  }
                })()
              : []);

        return {
          id: String(user.id),
          email: String(user.email || ''),
          roles: roles.map((role: any) => String(role)),
          isApiKey: true,
          jti: `api:${tokenId}`
        };
      } catch (error) {
        this.logger.error(`API key validation failed: ${error}`);
        return null;
      }
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
    // Dynamic Pre-Auth Plugin Middlewares
    this.app.use((req, res, next) => this.manager.middlewares.dispatch('pre_auth' as any, req, res, next));

    this.app.use((req: any, res, next) => {
      const locale = req.query.locale || req.cookies?.fc_locale || 'en';
      req.locale = locale;
      requestContext.run({ locale }, () => next());
    });

    this.app.use(this.auth.middleware());

    // Dynamic Post-Auth Plugin Middlewares
    this.app.use((req, res, next) => this.manager.middlewares.dispatch('post_auth' as any, req, res, next));

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
        req.path === LEGACY_API_ROUTES.SYSTEM.HEALTH ||
        req.path === API_ROUTES.SYSTEM.HEALTH ||
        req.path === LEGACY_API_ROUTES.SYSTEM.OPENAPI ||
        req.path === API_ROUTES.SYSTEM.OPENAPI ||
        req.path.startsWith(`${API_PREFIXES.BASE}/auth`) ||
        req.path.startsWith(`${API_PREFIXES.VERSIONED}/auth`) ||
        req.path === API_ROUTES.SYSTEM.I18N ||
        req.path === API_ROUTES.SYSTEM.EVENTS ||
        req.path.startsWith(PUBLIC_ROUTE_PREFIXES.PLUGIN_ASSETS);

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
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Framework-Client, X-CSRF-Token, X-Reset-Context');
      }

      res.status(503).json({
        error: 'Service Unavailable',
        message: 'System is currently undergoing maintenance. Please try again later.'
      });
    });

    // Dynamic Pre-Routing Plugin Middlewares
    this.app.use((req, res, next) => this.manager.middlewares.dispatch('pre_routing' as any, req, res, next));

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

    this.app.get(LEGACY_API_ROUTES.SYSTEM.HEALTH, async (req: any, res) => res.json({ 
      status: 'ok', 
      version: coreVersion,
      maintenance: await this.getMaintenanceStatus(),
      bypass: !!(req.user && req.user.roles && req.user.roles.includes('admin'))
    }));
    this.app.get(API_ROUTES.SYSTEM.HEALTH, async (req: any, res) => res.json({ 
      status: 'ok', 
      version: coreVersion,
      maintenance: await this.getMaintenanceStatus(),
      bypass: !!(req.user && req.user.roles && req.user.roles.includes('admin'))
    }));

    const vPrefix = API_PREFIXES.VERSIONED;
    
    // GraphQL Endpoint
    this.app.all(`${vPrefix}/graphql`, (req, res, next) => {
      createHandler({ 
        schema: this.graphQLService.generateSchema(),
        context: { req }
      })(req, res, next);
    });

    // Mount OpenAPI at both the generic and versioned path
    const openApiHandler = (req: any, res: any) => res.json(generateOpenAPI(this.manager.getCollections()));
    this.app.get(LEGACY_API_ROUTES.SYSTEM.OPENAPI, openApiHandler);
    this.app.get(API_ROUTES.SYSTEM.OPENAPI, openApiHandler);
    
    const vApi = express.Router();

    vApi.use('/auth', setupAuthRoutes(this.manager, this.auth));
    vApi.use('/plugins', setupPluginRoutes(this.manager, this.auth));
    vApi.use('/plugins', setupPluginSettingsRoutes(this.manager, this.auth));
    
    // Keep custom plugin routes before plugin collection fallback routes.
    vApi.use('/plugins', this.pluginRouter);

    vApi.use('/marketplace', setupMarketplaceRoutes(this.manager, this.auth));
    vApi.use('/themes', setupThemeRoutes(this.themeManager, this.auth));
    vApi.use('/system', setupSystemRoutes(this.manager, this.themeManager, this.auth, this.restController));
    vApi.use('/media', setupMediaRoutes(this.manager, this.auth, this.mediaManager));
    vApi.use('/versions', setupVersioningRoutes(this.manager, this.auth, this.restController));
    
    // Then mount collection routes as fallback for CRUD operations
    vApi.use(setupCollectionRoutes(this.manager, this.restController));
    
    // Mount versioned API
    this.app.use(vPrefix, vApi);

    // Mount unversioned API (default)
    this.app.use(API_PREFIXES.BASE, vApi);
    
    // Mount assets at root
    this.app.use('/plugins', setupPluginAssetRoutes(this.manager));
    this.app.use('/themes', setupThemeAssetRoutes(this.themeManager));

    this.app.use(API_ROUTES.COLLECTIONS.BASE, setupBaseCollectionRoutes(this.manager, this.restController));
    this.app.use(LEGACY_API_ROUTES.COLLECTIONS.BASE, setupBaseCollectionRoutes(this.manager, this.restController));
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
    this.pluginRouter.post('/:pluginSlug/:slug/bulk-update', middleware, (req: any, res) => this.restController.bulkUpdate(req.collection, req, res));
    this.pluginRouter.post('/:pluginSlug/:slug/bulk-delete', middleware, (req: any, res) => this.restController.bulkDelete(req.collection, req, res));
    this.pluginRouter.put('/:pluginSlug/:slug/:id', middleware, (req: any, res) => this.restController.update(req.collection, req, res));
    this.pluginRouter.patch('/:pluginSlug/:slug/:id', middleware, (req: any, res) => this.restController.update(req.collection, req, res));
    this.pluginRouter.delete('/:pluginSlug/:slug/:id', middleware, (req: any, res) => this.restController.delete(req.collection, req, res));
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
}

async function bootstrap() {
  // Load environment variables from .env files
  const projectRoot = path.resolve(process.cwd(), '../../');
  const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(projectRoot, '.env')
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  }

  process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
  });

  try {
    // Validate required environment variables early
    validateEnv();

    if (!process.env.DATABASE_URL) {
      console.error('FATAL ERROR: DATABASE_URL is not defined in environment or .env file.');
      console.error('Looked in:', envPaths);
      process.exit(1);
    }

    console.log('--- Initializing Fromcode API Server ---');
    
    // Register Default Adapters (Lazy)
    HookAdapterFactory.register('local', () => {
      const { LocalHookAdapter } = require('@fromcode/core/src/hooks/adapters/local-hook-adapter');
      return new LocalHookAdapter();
    });
    HookAdapterFactory.register('redis', (opts) => {
      const { RedisHookAdapter } = require('@fromcode/core/src/hooks/adapters/redis-hook-adapter');
      return new RedisHookAdapter(opts.redisUrl || process.env.REDIS_URL!, opts.namespace);
    });
    
    QueueAdapterFactory.register('local', () => {
      const { LocalQueueAdapter } = require('@fromcode/core/src/queue/adapters/local-queue-adapter');
      return new LocalQueueAdapter();
    });
    QueueAdapterFactory.register('bull', (opts) => {
      const { BullQueueAdapter } = require('@fromcode/core/src/queue/adapters/bull-queue-adapter');
      return new BullQueueAdapter(opts.redisUrl || process.env.REDIS_URL!, opts.namespace);
    });
    QueueAdapterFactory.register('redis', (opts) => QueueAdapterFactory.create('bull', opts));

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
    const themeManager = new ThemeManager((manager as any).db, manager);
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
      try {
        await themeManager.ensureActiveThemeDependencies();
      } catch (err) {
        console.error('ERROR: Active theme dependency enforcement failed.', err);
      }
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
