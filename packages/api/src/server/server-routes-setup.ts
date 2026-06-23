/** ServerRoutesSetup — registers API routes. Extracted from APIServer (ARC-007). */

import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { ApiVersionUtils, Logger, PluginManager, ThemeManager } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { MediaManager } from '@fromcode119/media';
import { RESTController } from '../controllers/rest/rest-controller';
import { ApiConfig } from '../config/api-config';
import { RouteConstants } from '@fromcode119/core';
import { AuthRouter } from '../routes/auth-router';
import { PluginAssetRouter } from '../routes/plugins/plugin-asset-router';
import { PluginRouter } from '../routes/plugins/plugin-router';
import { PluginSettingsRouter } from '../routes/plugins/plugin-settings-router';
import { ThemeRouter } from '../routes/themes/theme-router';
import { ThemeAssetRouter } from '../routes/themes/theme-asset-router';
import { MarketplaceRouter } from '../routes/marketplace';
import { AppearanceRouter } from '../routes/appearances';
import { SystemRouter } from '../routes/system-router';
import { MediaRouter } from '../routes/media-router';
import { VersioningRouter } from '../routes/versioning';
import { CollectionRouter } from '../routes/collection-router';
import { BaseCollectionRouter } from '../routes/base-collection-router';
import { CollectionMiddleware } from '../middlewares/collection-middleware';
import { SwaggerGenerator } from '../swagger';
import { GraphQLService } from '../services/graph-ql-service';
import { createHandler } from 'graphql-http/lib/use/express';

export class ServerRoutesSetup {
  constructor(
    private readonly app: express.Application,
    private readonly pluginRouter: express.Router,
    private readonly manager: PluginManager,
    private readonly themeManager: ThemeManager,
    private readonly auth: AuthManager,
    private readonly mediaManager: MediaManager,
    private readonly restController: RESTController,
    private readonly graphQLService: GraphQLService,
    private readonly getMaintenanceStatus: () => Promise<boolean>,
    private readonly logger: Logger,
  ) {}

  /**
   * Resolve the framework CORE version, read fresh on each call so a core update is reflected
   * without restarting. Walks up from `@fromcode119/core`'s resolved entry to its own
   * package.json (its `exports` map blocks a direct subpath require of package.json), matching on
   * `name === '@fromcode119/core'` so it never reports the root/app package.json by mistake.
   */
  private resolveCoreVersion(): string {
    const readPkg = (file: string): { name?: string; version?: string } | null => {
      try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {}
      return null;
    };
    const readVersion = (file: string): string | null => readPkg(file)?.version ?? null;
    // The framework ROOT package (@fromcode119/framework) is the canonical engine version — it is what
    // gets bumped on release. Individual packages (@fromcode119/core, …) may lag behind it, so read the
    // root FIRST (by name, so a stray package.json can't masquerade as it); packages are only fallbacks.
    for (const rootCandidate of [path.resolve(process.cwd(), 'package.json'), path.resolve(process.cwd(), '../../package.json')]) {
      const rootPkg = readPkg(rootCandidate);
      if (rootPkg?.name === '@fromcode119/framework' && rootPkg?.version) return rootPkg.version;
    }
    try {
      let dir = path.dirname(require.resolve('@fromcode119/core'));
      for (let i = 0; i < 6; i++) {
        const candidate = path.join(dir, 'package.json');
        try {
          if (fs.existsSync(candidate)) {
            const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'));
            if (pkg?.name === '@fromcode119/core' && pkg?.version) return pkg.version;
          }
        } catch {}
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    } catch {}
    return (
      readVersion(path.resolve(process.cwd(), 'packages/core/package.json')) ||
      readVersion(path.resolve(process.cwd(), 'package.json')) ||
      '0.0.0'
    );
  }

  async setupRoutes() {
    const healthHandler = async (req: any, res: any) => res.json({ status: 'ok', version: this.resolveCoreVersion(), maintenance: await this.getMaintenanceStatus(), bypass: !!(req.user?.roles?.includes('admin')) });
    this.app.get(ApiConfig.getInstance().probeRoutes.HEALTH, healthHandler);
    this.app.get(ApiConfig.getInstance().probeRoutes.READY, healthHandler);
    this.app.get(`${ApiVersionUtils.API_BASE_PATH}${ApiConfig.getInstance().probeRoutes.HEALTH}`, healthHandler);
    this.app.get(`${ApiVersionUtils.API_BASE_PATH}${ApiConfig.getInstance().probeRoutes.READY}`, healthHandler);
    this.app.get(ApiConfig.getInstance().routes.system.HEALTH, healthHandler);

    const vPrefix = ApiConfig.getInstance().prefixes.VERSIONED;
    this.app.all(`${vPrefix}/graphql`, (req, res, next) => { createHandler({ schema: this.graphQLService.generateSchema(), context: { req } })(req, res, next); });

    const openApiHandler = (req: any, res: any) => res.json(SwaggerGenerator.generate(this.manager.getCollections()));
    this.app.get(ApiConfig.getInstance().routes.system.OPENAPI, openApiHandler);

    const { AUTH, PLUGINS, MARKETPLACE, THEMES, APPEARANCES, SYSTEM, MEDIA, VERSIONS } = RouteConstants.SEGMENTS;
    const vApi = express.Router();
    const pluginAssetRouter = new PluginAssetRouter(this.manager).router;
    const themeAssetRouter = new ThemeAssetRouter(this.themeManager).router;

    vApi.use(AUTH, new AuthRouter(this.manager, this.auth).router);
    vApi.use(PLUGINS, pluginAssetRouter);
    vApi.use(PLUGINS, new PluginRouter(this.manager, this.auth).router);
    vApi.use(PLUGINS, new PluginSettingsRouter(this.manager, this.auth).router);
    vApi.use(PLUGINS, this.pluginRouter);
    vApi.use(MARKETPLACE, new MarketplaceRouter(this.manager, this.auth).router);
    vApi.use(THEMES, themeAssetRouter);
    vApi.use(THEMES, new ThemeRouter(this.themeManager, this.auth).router);
    vApi.use(APPEARANCES, new AppearanceRouter(this.auth).router);
    this.registerCoreExtensionRoutes(vApi);
    vApi.use(SYSTEM, new SystemRouter(this.manager, this.themeManager, this.auth, this.restController).router);
    vApi.use(MEDIA, new MediaRouter(this.manager, this.auth, this.mediaManager).router);
    vApi.use(VERSIONS, new VersioningRouter(this.manager, this.auth, this.restController).router);

    vApi.use(new CollectionRouter(this.manager, this.restController).router);
    this.app.use(vPrefix, vApi);
    this.app.use(PLUGINS, pluginAssetRouter);
    this.app.use(THEMES, themeAssetRouter);

    const baseCollectionRouter = new BaseCollectionRouter(this.manager, this.restController).router;
    this.app.use(ApiConfig.getInstance().routes.collections.BASE, baseCollectionRouter);
  }

  private registerCoreExtensionRoutes(vApi: express.Router): void {
    const registeredRoutes = this.manager.extensions?.getRegisteredApiRoutes?.();
    if (!registeredRoutes || registeredRoutes.size === 0) {
      return;
    }

    for (const factory of registeredRoutes.values()) {
      if (typeof factory !== 'function') {
        continue;
      }

      const registered = factory({
        manager: this.manager,
        themeManager: this.themeManager,
        auth: this.auth,
        restController: this.restController,
      });
      const basePath = String(registered?.basePath || '').trim().replace(/^\/+/, '');
      if (!basePath || !registered?.router) {
        continue;
      }

      vApi.use(`/${basePath}`, registered.router);
    }
  }

  async registerCoreCollection(slug: string, collection: any) {
    const existing = this.manager.getCollections().find((c) => c.slug === slug);
    if (!existing) {
      (this.manager as any).registeredCollections.set(slug, { collection, pluginSlug: 'system' });
      await this.manager.schemaManager.syncCollection(collection);
    }
  }

  setupPluginCollectionProxy() {
    this.logger.info('Setting up automated Plugin Collection Proxy routes...');
    const middleware = new CollectionMiddleware(this.manager).middleware();
    this.pluginRouter.get('/:pluginSlug/:slug', middleware, (req: any, res) => this.restController.find(req.collection, req, res));
    this.pluginRouter.get('/:pluginSlug/:slug/:id', middleware, (req: any, res) => this.restController.findOne(req.collection, req, res));
    this.pluginRouter.post('/:pluginSlug/:slug', middleware, (req: any, res) => this.restController.create(req.collection, req, res));
    this.pluginRouter.post('/:pluginSlug/:slug/bulk-update', middleware, (req: any, res) => this.restController.bulkUpdate(req.collection, req, res));
    this.pluginRouter.post('/:pluginSlug/:slug/bulk-delete', middleware, (req: any, res) => this.restController.bulkDelete(req.collection, req, res));
    this.pluginRouter.put('/:pluginSlug/:slug/:id', middleware, (req: any, res) => this.restController.update(req.collection, req, res));
    this.pluginRouter.patch('/:pluginSlug/:slug/:id', middleware, (req: any, res) => this.restController.update(req.collection, req, res));
    this.pluginRouter.delete('/:pluginSlug/:slug/:id', middleware, (req: any, res) => this.restController.delete(req.collection, req, res));
  }
}
