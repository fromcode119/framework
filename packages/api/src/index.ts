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
  EnvConfig,
  HookAdapterFactory,
  QueueAdapterFactory,
  SystemTable
} from '@fromcode119/core';
import { SystemMetaKey } from '@fromcode119/sdk/internal';
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
import { PluginAssetRouter } from './routes/plugins';
import { PluginRouter } from './routes/plugin-router';
import { PluginSettingsRouter } from './routes/plugin-settings';
import { ThemeRouter, ThemeAssetRouter } from './routes/theme-router';
import { MarketplaceRouter } from './routes/marketplace';
import { SystemRouter } from './routes/system-router';
import { MediaRouter } from './routes/media-router';
import { VersioningRouter } from './routes/versioning';
import { CollectionRouter, BaseCollectionRouter } from './routes/collection-router';
import { UserCollection, MediaCollection, SettingsCollection } from './collections/core';
import { SwaggerGenerator } from './swagger';
import { CollectionMiddleware } from './middlewares/collection-middleware';
import { CSRFMiddleware, XSSMiddleware } from './middlewares/security-middleware';
import { SchedulerService } from '@fromcode119/scheduler';
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
  private settingsInterval?: NodeJS.Timeout;
  
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
    await this.registerCoreCollection('users', UserCollection);
    await this.registerCoreCollection('media', MediaCollection);
    await this.registerCoreCollection('settings', SettingsCollection);
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
    // Initial load - must be completed before server accepts requests
    await this.refreshSettingsCache();
    
    // Refresh every 5 minutes (production) or 10 seconds (development)
    const interval = process.env.NODE_ENV === 'development' ? 10 * 1000 : 5 * 60 * 1000;
    this.settingsInterval = setInterval(() => {
      this.refreshSettingsCache().catch(err => this.logger.error('Background cache sync failed: ' + err));
    }, interval);
  }

  private async refreshSettingsCache() {
    try {
      const db = (this.manager as any).db;
      
      const hasMetaTable = await db.tableExists(SystemTable.META);
      if (!hasMetaTable) {
        this.logger.warn(`System meta table "${SystemTable.META}" not found. Skipping settings sync.`);
        return;
      }

      const rows = await db.find(SystemTable.META, {
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
      
      const hasMetaTable = await db.tableExists(SystemTable.META);
      if (!hasMetaTable) {
        this.logger.warn(`System meta table "${SystemTable.META}" not found. Skipping default settings injection.`);
        return;
      }

      const defaults = [
        { key: SystemMetaKey.PLATFORM_NAME, value: 'Fromcode Core', description: 'The identity of your platform instance.', group: 'General' },
        { key: SystemMetaKey.SITE_NAME, value: 'Fromcode', description: 'Public site name used in emails and frontend.', group: 'General' },
        { key: SystemMetaKey.SITE_URL, value: 'http://localhost:3000', description: 'Base URL for the public site.', group: 'General' },
        { key: SystemMetaKey.FRONTEND_URL, value: 'http://localhost:3000', description: 'The primary URL for your frontend application.', group: 'General' },
        { key: SystemMetaKey.ADMIN_URL, value: 'http://localhost:3001', description: 'The primary URL for your admin dashboard.', group: 'General' },
        { key: SystemMetaKey.PLATFORM_DOMAIN, value: 'framework.local', description: 'Root domain for the entire platform setup (e.g. example.com). Used for cross-site cookie sharing and CORS validation.', group: 'General' },
        { key: SystemMetaKey.TIMEZONE, value: 'UTC', description: 'Default system timezone for scheduling and display.', group: 'General' },
        { key: SystemMetaKey.ROUTING_HOME_TARGET, value: 'auto', description: 'Homepage route target. Examples: auto, layout:<name>, collection:<slug>:<id>', group: 'Routing' },
        { key: SystemMetaKey.PERMALINK_STRUCTURE, value: '/:slug', description: 'The default URL structure for your content (e.g. /:year/:month/:slug)', group: 'General' },
        { key: SystemMetaKey.MAINTENANCE_MODE, value: 'false', description: 'Enable global maintenance mode (blocks non-admin API access)', group: 'Settings' },
        { key: SystemMetaKey.RATE_LIMIT_MAX, value: '100', description: 'Maximum requests per window per IP', group: 'security' },
        { key: SystemMetaKey.RATE_LIMIT_WINDOW, value: '900000', description: 'Rate limit window in milliseconds (15min = 900000)', group: 'security' },
        { key: SystemMetaKey.AUTH_SESSION_DURATION, value: '10080', description: 'Login session duration in minutes for access token/cookie/session expiry.', group: 'security' },
        { key: SystemMetaKey.AUTH_PASSWORD_MIN_LENGTH, value: '8', description: 'Minimum required password length.', group: 'security' },
        { key: SystemMetaKey.AUTH_PASSWORD_REQUIRE_UPPERCASE, value: 'true', description: 'Require uppercase letters in passwords.', group: 'security' },
        { key: SystemMetaKey.AUTH_PASSWORD_REQUIRE_LOWERCASE, value: 'true', description: 'Require lowercase letters in passwords.', group: 'security' },
        { key: SystemMetaKey.AUTH_PASSWORD_REQUIRE_NUMBER, value: 'true', description: 'Require digits in passwords.', group: 'security' },
        { key: SystemMetaKey.AUTH_PASSWORD_REQUIRE_SYMBOL, value: 'false', description: 'Require symbols in passwords.', group: 'security' },
        { key: SystemMetaKey.AUTH_PASSWORD_HISTORY, value: '5', description: 'Prevent reuse of the last N passwords.', group: 'security' },
        { key: SystemMetaKey.AUTH_PASSWORD_BREACH_CHECK, value: 'false', description: 'Enable optional breach-check hook for passwords.', group: 'security' },
        { key: SystemMetaKey.AUTH_PASSWORD_RESET_TOKEN_MINUTES, value: '30', description: 'Password reset token lifetime in minutes.', group: 'security' },
        { key: SystemMetaKey.AUTH_EMAIL_CHANGE_TOKEN_MINUTES, value: '60', description: 'Email change token lifetime in minutes.', group: 'security' },
        { key: SystemMetaKey.AUTH_LOCKOUT_THRESHOLD, value: '5', description: 'Failed login attempts before temporary lockout.', group: 'security' },
        { key: SystemMetaKey.AUTH_LOCKOUT_WINDOW_MINUTES, value: '15', description: 'Window in minutes for counting failed logins.', group: 'security' },
        { key: SystemMetaKey.AUTH_LOCKOUT_DURATION_MINUTES, value: '30', description: 'Lockout duration in minutes after threshold is reached.', group: 'security' },
        { key: SystemMetaKey.AUTH_CAPTCHA_ENABLED, value: 'false', description: 'Require captcha after repeated login failures.', group: 'security' },
        { key: SystemMetaKey.AUTH_CAPTCHA_THRESHOLD, value: '3', description: 'Failed attempts before captcha is required.', group: 'security' },
        { key: SystemMetaKey.AUTH_SECURITY_NOTIFICATIONS, value: 'true', description: 'Send user-facing security notification emails for auth events.', group: 'security' },
        { key: SystemMetaKey.TWO_FACTOR_ENABLED, value: 'false', description: 'Enable two-factor authentication for admin accounts.', group: 'security' },
        { key: SystemMetaKey.LOCALIZATION_LOCALES, value: '[{"code":"en","name":"English","enabled":true}]', description: 'JSON array of available locales with code, name and enabled state.', group: 'Localization' },
        { key: SystemMetaKey.ENABLED_LOCALES, value: 'en', description: 'Comma-separated list of enabled locale codes for compatibility layers.', group: 'Localization' },
        { key: SystemMetaKey.DEFAULT_LOCALE, value: 'en', description: 'Default locale for system-level operations.', group: 'Localization' },
        { key: SystemMetaKey.ADMIN_DEFAULT_LOCALE, value: 'en', description: 'Default language for the admin interface.', group: 'Localization' },
        { key: SystemMetaKey.FRONTEND_DEFAULT_LOCALE, value: 'en', description: 'Default language for public frontend rendering.', group: 'Localization' },
        { key: SystemMetaKey.LOCALE_URL_STRATEGY, value: 'query', description: 'Locale URL strategy for frontend routes: query, path, or none.', group: 'Localization' },
        { key: SystemMetaKey.FRONTEND_AUTH_ENABLED, value: 'true', description: 'Enable customer-facing authentication flows on the frontend (register, verify, forgot/reset password).', group: 'security' },
        { key: SystemMetaKey.FRONTEND_REGISTRATION_ENABLED, value: 'true', description: 'Allow new customer self-registration on the frontend.', group: 'security' },
        { key: SystemMetaKey.EMAIL_NOTIFICATIONS, value: 'true', description: 'Receive system alerts and audit snapshots via email.', group: 'Engagement' }
      ];

      for (const d of defaults) {
        const existing = await db.findOne(SystemTable.META, { key: d.key });
        if (!existing) {
          await db.insert(SystemTable.META, d);
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
            await db.update(SystemTable.META, { key: d.key }, { 
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
          const platformDomain = this.settingsCache.get(SystemMetaKey.PLATFORM_DOMAIN);
          const adminUrl = this.settingsCache.get(SystemMetaKey.ADMIN_URL);
          const frontendUrl = this.settingsCache.get(SystemMetaKey.FRONTEND_URL);

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
    // Initialize Permission Checker
    const db = (this.manager as any).db;
    const { UserPermissionChecker } = require('@fromcode119/auth');
    const permissionChecker = new UserPermissionChecker(db);
    this.auth.setPermissionChecker(permissionChecker);
    this.logger.info('Permission checker initialized and configured');

    this.auth.setSessionValidator(async (jti) => {
      try {
        // Use the driver's find method instead of raw drizzle
        const results = await db.find(systemSessions, {
          where: db.eq(systemSessions.tokenId, jti),
          limit: 1
        });
        
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
        const lookupRow = await db.findOne(SystemTable.META, { key: `auth:api_token:${keyHash}` });
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
      let redisVal = await this.cache.get(`system_setting:${SystemMetaKey.MAINTENANCE_MODE}`);
      
      // 2. Fallback to Local Memory Map
      let memoryVal = this.settingsCache.get(SystemMetaKey.MAINTENANCE_MODE);

      let val = redisVal;
      if (val === null || val === undefined) val = memoryVal;

      // 3. Emergency DB Sync - only if both caches are empty
      if (val === null || val === undefined) {
        const db = (this.manager as any).db;
        
        const hasMetaTable = await db.tableExists(SystemTable.META);
        if (!hasMetaTable) {
           return true; // Default ON if meta table is missing (fail-safe)
        }

        const row = await db.findOne(SystemTable.META, { key: SystemMetaKey.MAINTENANCE_MODE });
        if (row) {
          val = row.value;
          this.settingsCache.set(SystemMetaKey.MAINTENANCE_MODE, row.value);
          await this.cache.set(`system_setting:${SystemMetaKey.MAINTENANCE_MODE}`, row.value);
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
        req.path === ApiConfig.getInstance().legacyRoutes.system.HEALTH ||
        req.path === ApiConfig.getInstance().routes.system.HEALTH ||
        req.path === ApiConfig.getInstance().legacyRoutes.system.OPENAPI ||
        req.path === ApiConfig.getInstance().routes.system.OPENAPI ||
        req.path.startsWith(`${ApiConfig.getInstance().prefixes.BASE}/auth`) ||
        req.path.startsWith(`${ApiConfig.getInstance().prefixes.VERSIONED}/auth`) ||
        req.path === ApiConfig.getInstance().routes.system.I18N ||
        req.path === ApiConfig.getInstance().routes.system.EVENTS ||
        req.path.startsWith(ApiConfig.getInstance().publicRoutePrefixes.PLUGIN_ASSETS);

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

  private async setupRoutes() {
    // Dynamically load version from package.json if available
    let coreVersion = '0.1.0';
    try {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        coreVersion = pkg.version || coreVersion;
      }
    } catch (e) {}

    this.app.get(ApiConfig.getInstance().legacyRoutes.system.HEALTH, async (req: any, res) => res.json({ 
      status: 'ok', 
      version: coreVersion,
      maintenance: await this.getMaintenanceStatus(),
      bypass: !!(req.user && req.user.roles && req.user.roles.includes('admin'))
    }));
    this.app.get(ApiConfig.getInstance().routes.system.HEALTH, async (req: any, res) => res.json({ 
      status: 'ok', 
      version: coreVersion,
      maintenance: await this.getMaintenanceStatus(),
      bypass: !!(req.user && req.user.roles && req.user.roles.includes('admin'))
    }));

    const vPrefix = ApiConfig.getInstance().prefixes.VERSIONED;
    
    // GraphQL Endpoint
    this.app.all(`${vPrefix}/graphql`, (req, res, next) => {
      createHandler({ 
        schema: this.graphQLService.generateSchema(),
        context: { req }
      })(req, res, next);
    });

    // Mount OpenAPI at both the generic and versioned path
    const openApiHandler = (req: any, res: any) => res.json(SwaggerGenerator.generate(this.manager.getCollections()));
    this.app.get(ApiConfig.getInstance().legacyRoutes.system.OPENAPI, openApiHandler);
    this.app.get(ApiConfig.getInstance().routes.system.OPENAPI, openApiHandler);
    
    const vApi = express.Router();

    vApi.use('/auth', new AuthRouter(this.manager, this.auth).router);
    vApi.use('/plugins', new PluginRouter(this.manager, this.auth).router);
    vApi.use('/plugins', new PluginSettingsRouter(this.manager, this.auth).router);
    
    // Keep custom plugin routes before plugin collection fallback routes.
    vApi.use('/plugins', this.pluginRouter);

    vApi.use('/marketplace', new MarketplaceRouter(this.manager, this.auth).router);
    vApi.use('/themes', new ThemeRouter(this.themeManager, this.auth).router);
    vApi.use('/system', new SystemRouter(this.manager, this.themeManager, this.auth, this.restController).router);
    vApi.use('/media', new MediaRouter(this.manager, this.auth, this.mediaManager).router);
    vApi.use('/versions', new VersioningRouter(this.manager, this.auth, this.restController).router);
    
    // Mount extension routes (registered by extensions through CoreExtensionManager)
    if (this.manager.extensions && typeof (this.manager.extensions as any).getRegisteredApiRoutes === 'function') {
      try {
        const extensionRoutes = (this.manager.extensions as any).getRegisteredApiRoutes();
        for (const [extensionSlug, routeFactory] of extensionRoutes) {
          try {
            const extension = (this.manager.extensions as any).getExtension(extensionSlug);
            const apiPath = extension?.manifest?.apiPath || extensionSlug;
            
            this.logger.info(`Mounting API routes for extension: ${extensionSlug} at /${apiPath}`);
            const router = routeFactory({
              manager: this.manager,
              themeManager: this.themeManager,
              auth: this.auth,
              restController: this.restController,
            });
            vApi.use(`/${apiPath}`, router);
            this.logger.info(`Successfully mounted routes for extension: ${extensionSlug}`);
          } catch (error) {
            this.logger.error(`Failed to mount routes for extension ${extensionSlug}:`, error);
          }
        }
      } catch (e) {
        this.logger.error('Failed to get extension routes:', e);
      }
    }
    vApi.use(new CollectionRouter(this.manager, this.restController).router);
    
    // Mount versioned API
    this.app.use(vPrefix, vApi);

    // Mount unversioned API (default)
    this.app.use(ApiConfig.getInstance().prefixes.BASE, vApi);
    
    // Mount assets at root
    this.app.use('/plugins', new PluginAssetRouter(this.manager).router);
    this.app.use('/themes', new ThemeAssetRouter(this.themeManager).router);

    // Mount base collection routes at root (mainly for legacy integrations)
    const baseCollectionRouter = new BaseCollectionRouter(this.manager, this.restController).router;
    this.app.use(ApiConfig.getInstance().routes.collections.BASE, baseCollectionRouter);
    this.app.use(ApiConfig.getInstance().legacyRoutes.collections.BASE, baseCollectionRouter);
  }

  private async registerCoreCollection(slug: string, collection: any) {
    const existing = this.manager.getCollections().find(c => c.slug === slug);
    if (!existing) {
      (this.manager as any).registeredCollections.set(slug, { 
        collection, 
        pluginSlug: 'system' 
      });
      // Ensure the schema is in sync for core collections
      await this.manager.schemaManager.syncCollection(collection);
    }
  }

  public setupPluginCollectionProxy() {
    this.logger.info('Setting up automated Plugin Collection Proxy routes...');
    const middleware = new CollectionMiddleware(this.manager).middleware();

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



if (require.main === module) {
  APIServer.bootstrap().catch(err => {
    console.error('Unhandled exception during bootstrap execution:', err);
    process.exit(1);
  });
}