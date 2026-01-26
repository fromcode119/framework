import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { PluginManager, Logger, requestContext, HotReloadService } from '@fromcode/core';
import { AuthManager } from '@fromcode/auth';
import { MediaManager } from '@fromcode/media';
import { systemSessions, eq, and, gt } from '@fromcode/database';
import * as path from 'path';
import { RESTController } from './rest-controller';
import { API_ROUTES } from './constants';
import { createCollectionMiddleware } from './middlewares/collection';
import { setupAuthRoutes } from './routes/auth';
import { setupPluginRoutes, setupPluginAssetRoutes } from './routes/plugins';
import { setupSystemRoutes } from './routes/system';
import { setupMediaRoutes } from './routes/media';
import { generateOpenAPI } from './swagger';

const UserCollection = {
// ... existing UserCollection ...
  slug: 'users',
  name: 'Users',
  system: true,
  priority: 1,
  fields: [
    { name: 'email', label: 'E-Mail', type: 'text', required: true, unique: true },
    { name: 'username', label: 'Username', type: 'text', unique: true },
    { name: 'password', label: 'Password', type: 'password', required: true, admin: { hidden: true } },
    { name: 'roles', label: 'Roles', type: 'json', admin: { component: 'Tags' } },
    { name: 'permissions', label: 'Permissions', type: 'json', admin: { component: 'Tags' } },
    { name: 'firstName', label: 'First Name', type: 'text' },
    { name: 'lastName', label: 'Last Name', type: 'text' }
  ],
  admin: {
    group: 'Platform',
    icon: 'Users',
    useAsTitle: 'email',
    defaultColumns: ['email', 'username', 'roles', 'createdAt']
  }
};

const MediaCollection = {
  slug: 'media',
  name: 'Media',
  system: true,
  priority: 2,
  fields: [
    { name: 'filename', label: 'Filename', type: 'text', required: true },
    { name: 'alt', label: 'Alt Text', type: 'text' },
    { name: 'mimeType', label: 'Type', type: 'text' },
    { name: 'fileSize', label: 'Size', type: 'number' },
    { name: 'width', label: 'Width', type: 'number' },
    { name: 'height', label: 'Height', type: 'number' },
    { name: 'folderId', label: 'Folder', type: 'number' }
  ],
  admin: {
    group: 'Platform',
    icon: 'Image',
    useAsTitle: 'filename'
  }
};

export class APIServer {
  public app = express();
  private logger = new Logger({ namespace: 'APIServer' });
  private restController: RESTController;
  private mediaManager: MediaManager;
  
  constructor(private manager: PluginManager, private auth: AuthManager) {
    this.restController = new RESTController((manager as any).db, this.auth);
    
    // 1. First Middleware: CORS (before anything else)
    this.setupCors();

    // 2. Express standard configs
    this.app.set('trust proxy', 1);
    this.app.use(express.json());
    this.app.use(cookieParser());

    // 3. Basic Rate Limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'development' ? 10000 : 100, // Limit each IP
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
    });
    this.app.use('/api/', limiter);

    // Dynamic Storage Setup
    this.mediaManager = (this.manager as any).storage;

    // Static Assets
    const systemUploadDir = process.env.STORAGE_UPLOAD_DIR || path.resolve(process.cwd(), 'public/uploads');
    this.app.use('/uploads', express.static(systemUploadDir));

    // Auth Integration
    this.setupAuthIntegration();

    // Core Collections
    this.registerCoreCollection('users', UserCollection);
    this.registerCoreCollection('media', MediaCollection);

    // Context & Auth Middlewares
    this.setupMiddleware();

    // Routes
    this.setupRoutes();
  }

  private setupCors() {
    this.app.use(cors({
      origin: (origin, callback) => {
        // In some server-to-server or non-browser requests, origin might be missing.
        if (!origin) return callback(null, true);

        try {
          const { hostname } = new URL(origin);
          
          // List of allowed base domains
          const envAllowed = process.env.CORS_ALLOWED_DOMAINS 
            ? process.env.CORS_ALLOWED_DOMAINS.split(',').map(d => d.trim().toLowerCase())
            : [];
          
          // Automatically allow common local dev hostnames
          const allowedDomains = ['localhost', '127.0.0.1', 'framework.local', ...envAllowed];
          
          const isAllowed = allowedDomains.some(domain => {
            const lowHost = hostname.toLowerCase();
            const lowDomain = domain.toLowerCase();
            return lowHost === lowDomain || lowHost.endsWith(`.${lowDomain}`);
          });
          
          if (isAllowed || process.env.NODE_ENV === 'development') {
            callback(null, true);
          } else {
            this.logger.warn(`CORS blocked for origin: ${origin} (Hostname: ${hostname})`);
            callback(null, false); // Block without throwing to prevent 500
          }
        } catch (err) {
          this.logger.error(`Error parsing origin URL: ${origin}`, err);
          callback(null, false);
        }
      },
      credentials: true
    }));
  }

  private setupAuthIntegration() {
    this.auth.setSessionValidator(async (jti) => {
      try {
        const db = (this.manager as any).db.drizzle;
        const [session]: any = await db.select()
          .from(systemSessions)
          .where(and(
            eq(systemSessions.tokenId, jti),
            eq(systemSessions.isRevoked, false),
            gt(systemSessions.expiresAt, new Date())
          ))
          .limit(1);
        return !!session;
      } catch (e) {
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

  private setupMiddleware() {
    this.app.use((req: any, res, next) => {
      const locale = req.query.locale || req.cookies?.fc_locale || 'en';
      req.locale = locale;
      requestContext.run({ locale }, () => next());
    });

    this.app.use(this.auth.middleware());

    this.app.use((req: any, res, next) => {
      const hasToken = !!(req.cookies?.fc_token || req.headers.authorization);
      const cookieCount = req.cookies ? Object.keys(req.cookies).length : 0;
      
      this.logger.debug(`${req.method} ${req.url} - User: ${req.user ? req.user.email : 'None'} - HasToken: ${hasToken} - Cookies: ${cookieCount} (${Object.keys(req.cookies || {}).join(', ')})`);
      
      if (!req.user && hasToken) {
        this.logger.warn(`Token present but user not authenticated for ${req.url}. Possibly expired or invalid format.`);
      }
      next();
    });
  }

  private setupRoutes() {
    this.app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));
    this.app.get('/api/openapi.json', (req, res) => res.json(generateOpenAPI(this.manager.getCollections())));

    const apiVersion = process.env.API_VERSION_PREFIX || 'v1';
    const vPrefix = `/api/${apiVersion}`;
    
    const vApi = express.Router();

    vApi.use('/auth', setupAuthRoutes(this.manager, this.auth));
    vApi.use('/plugins', setupPluginRoutes(this.manager, this.auth));
    vApi.use('/system', setupSystemRoutes(this.manager, this.auth, this.restController));
    vApi.use('/media', setupMediaRoutes(this.manager, this.auth, this.mediaManager));
    
    // Add collections to versioned API
    this.setupCollectionRoutes(vApi);

    // Mount versioned API
    this.app.use(vPrefix, vApi);

    // Legacy support (to avoid breaking current admin)
    this.app.use('/api/auth', setupAuthRoutes(this.manager, this.auth));
    this.app.use('/api/plugins', setupPluginRoutes(this.manager, this.auth));
    this.app.use('/api/media', setupMediaRoutes(this.manager, this.auth, this.mediaManager));
    this.app.use('/api/system', setupSystemRoutes(this.manager, this.auth, this.restController));
    
    // Mount assets at root
    this.app.use('/plugins', setupPluginAssetRoutes(this.manager));

    this.setupLegacyCollectionRoutes();
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

  private setupCollectionRoutes(router: express.Router) {
    const collectionMiddleware = createCollectionMiddleware(this.manager);

    router.get('/collections/:slug', collectionMiddleware, (req: any, res) => this.restController.find(req.collection, req, res));
    router.get('/collections/:slug/suggestions/:field', collectionMiddleware, (req: any, res) => this.restController.getSuggestions(req.collection, req, res));
    router.get('/collections/:slug/:id', collectionMiddleware, (req: any, res) => this.restController.findOne(req.collection, req, res));
    router.post('/collections/:slug', collectionMiddleware, (req: any, res) => this.restController.create(req.collection, req, res));
    router.put('/collections/:slug/:id', collectionMiddleware, (req: any, res) => this.restController.update(req.collection, req, res));
    router.delete('/collections/:slug/:id', collectionMiddleware, (req: any, res) => this.restController.delete(req.collection, req, res));
  }

  private setupLegacyCollectionRoutes() {
    const router = express.Router();
    const collectionMiddleware = createCollectionMiddleware(this.manager);

    router.get('/:slug', collectionMiddleware, (req: any, res) => this.restController.find(req.collection, req, res));
    router.get('/:slug/suggestions/:field', collectionMiddleware, (req: any, res) => this.restController.getSuggestions(req.collection, req, res));
    router.get('/:slug/:id', collectionMiddleware, (req: any, res) => this.restController.findOne(req.collection, req, res));
    router.post('/:slug', collectionMiddleware, (req: any, res) => this.restController.create(req.collection, req, res));
    router.put('/:slug/:id', collectionMiddleware, (req: any, res) => this.restController.update(req.collection, req, res));
    router.delete('/:slug/:id', collectionMiddleware, (req: any, res) => this.restController.delete(req.collection, req, res));

    this.app.use(API_ROUTES.COLLECTIONS.BASE, router);
  }

  start(port: number = 3000, host: string = '0.0.0.0') {
    this.app.listen(port, host, () => {
      this.logger.info(`Running on http://${host}:${port}`);
    });
  }
}

async function bootstrap() {
  const manager = new PluginManager();
  await manager.init();
  const auth = new AuthManager();
  const server = new APIServer(manager, auth);

  manager.setAuth(auth);
  manager.setApiHost((server as any).app);
  await manager.discoverPlugins();

  if (process.env.NODE_ENV === 'development') {
    const hotReload = new HotReloadService(manager, manager.pluginsRoot);
    hotReload.start();
  }

  server.start(Number(process.env.PORT) || 3000);
  manager.emit('system:ready', { timestamp: Date.now() });
}

if (require.main === module) {
  bootstrap();
}

