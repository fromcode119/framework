/** ServerRoutesSetup — registers API routes. Extracted from APIServer (ARC-007). */

import express from 'express';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';
import { TenantPluginGuard } from '@api/middlewares/tenant-plugin-guard';
import { PlatformAccessResolver } from '@api/services/request/platform-access-resolver';
import * as path from 'path';
import * as fs from 'fs';
import { ApiVersionUtils, CollectionWriteBridge, Logger, PluginManager, TenantMembershipService, TenantRegistryService, TenantResolverService, ThemeManager } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { MediaManager } from '@fromcode119/media';
import { RESTController } from '@api/controllers/rest/rest-controller';
import { ApiConfig } from '@api/config/api-config';
import { RouteConstants } from '@fromcode119/core';
import { AuthRouter } from '@api/routes/auth-router';
import { PluginAssetRouter } from '@api/routes/plugins/plugin-asset-router';
import { PluginRouter } from '@api/routes/plugins/plugin-router';
import { PluginSettingsRouter } from '@api/routes/plugins/plugin-settings-router';
import { ThemeRouter } from '@api/routes/themes/theme-router';
import { ThemeAssetRouter } from '@api/routes/themes/theme-asset-router';
import { MarketplaceRouter } from '@api/routes/marketplace';
import { AppearanceRouter } from '@api/routes/appearances';
import { SourcesModule } from '@fromcode119/sources';
import { PlatformSettingsService } from '@fromcode119/core';
import { CoreServices } from '@fromcode119/core';
import { SystemRouter } from '@api/routes/system-router';
import { TenantAdminRouter } from '@api/routes/tenant-admin-router';
import { ServerUploadsConfigService } from '@api/server/server-uploads-config-service';
import { ScimRouter } from '@api/routes/scim-router';
import { UserPermissionChecker } from '@fromcode119/auth';
import { MediaRouter } from '@api/routes/media-router';
import { McpRouter } from '@api/routes/mcp-routes';
import { RoutingRouter } from '@api/routes/routing-router';
import { McpFrameworkToolsRegistrar } from '@api/controllers/mcp/mcp-framework-tools-registrar';
import { McpAuditRecorder } from '@api/controllers/mcp/mcp-audit-recorder';
import { FilesRouter } from '@api/routes/files-router';
import { VersioningRouter } from '@api/routes/versioning';
import { CollectionRouter } from '@api/routes/collection-router';
import { BaseCollectionRouter } from '@api/routes/base-collection-router';
import { CollectionMiddleware } from '@api/middlewares/collection-middleware';
import { SwaggerGenerator } from '@api/swagger';
import { DeveloperPortalHtml } from '@api/utils/developer-portal-html';
import { GraphQLService } from '@api/services/graph-ql-service';
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
    /** The live settings map, so routes read operator-tunable limits at request time. */
    private readonly settingsCache: Map<string, string> = new Map(),
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
    // The framework ROOT package (@fromcode119/framework) is the canonical engine version, and now the
    // ONLY package that carries one: workspace packages dropped theirs, because a number stamped into
    // 26 files every release described nothing any of them had changed. Matched by NAME, so a stray
    // package.json in the working directory cannot masquerade as it.
    for (const rootCandidate of [path.resolve(process.cwd(), 'package.json'), path.resolve(process.cwd(), '../../package.json')]) {
      const rootPkg = readPkg(rootCandidate);
      if (rootPkg?.name === '@fromcode119/framework' && rootPkg?.version) return rootPkg.version;
    }
    return readVersion(path.resolve(process.cwd(), '../../package.json')) || '0.0.0';
  }

  async setupRoutes() {
    // The canonical in-plugin collection write path: `context.collections.update()` forwards here,
    // so a plugin write goes through the SAME controller an admin save does — access policy,
    // validation and collection lifecycle hooks included. Pushed into core (core cannot import api).
    CollectionWriteBridge.install(async (collectionSlug, id, data, actor) => {
      const collection = this.manager.getCollections().find((candidate) => candidate.slug === collectionSlug);
      if (!collection) throw new Error(`Unknown collection "${collectionSlug}".`);
      return this.restController.update(collection, {
        body: data, query: {}, params: { id: String(id) }, user: actor, headers: {}, cookies: {},
      });
    });

    const healthHandler = async (req: any, res: any) => res.json({ status: 'ok', version: this.resolveCoreVersion(), maintenance: await this.getMaintenanceStatus(), bypass: !!(req.user?.roles?.includes('admin')) });
    this.app.get(ApiConfig.getInstance().probeRoutes.HEALTH, healthHandler);
    this.app.get(ApiConfig.getInstance().probeRoutes.READY, healthHandler);
    this.app.get(`${ApiVersionUtils.API_BASE_PATH}${ApiConfig.getInstance().probeRoutes.HEALTH}`, healthHandler);
    this.app.get(`${ApiVersionUtils.API_BASE_PATH}${ApiConfig.getInstance().probeRoutes.READY}`, healthHandler);
    this.app.get(ApiConfig.getInstance().routes.system.HEALTH, healthHandler);

    const vPrefix = ApiConfig.getInstance().prefixes.VERSIONED;
    this.app.all(`${vPrefix}/graphql`, (req, res, next) => { createHandler({ schema: this.graphQLService.generateSchema(), context: { req } })(req, res, next); });

    // Live OpenAPI spec (self-generates from the running collection schemas) and its public Redoc
    // developer portal. Both paths come from the route config — no string-munging one from the other.
    const systemRoutes = ApiConfig.getInstance().routes.system;
    this.app.get(systemRoutes.OPENAPI, (_req, res) => res.json(SwaggerGenerator.generate(this.manager.getCollections())));
    this.app.get(systemRoutes.DOCS, (_req, res) => res.type('html').send(DeveloperPortalHtml.render(systemRoutes.OPENAPI)));

    const { AUTH, PLUGINS, MARKETPLACE, THEMES, APPEARANCES, SOURCES, SYSTEM, MEDIA, FILES, VERSIONS } = RouteConstants.SEGMENTS;
    const vApi = express.Router();
    const pluginAssetRouter = new PluginAssetRouter(this.manager).router;
    const themeAssetRouter = new ThemeAssetRouter(this.themeManager).router;

    // One resolver, shared by the guards AND the list filters, so "who is a platform admin" is
    // answered in exactly one place and memoised per request.
    const platformAccess = new PlatformAccessResolver((this.manager as any).schemaDb ?? this.manager.db);
    const platformAdmin = new PlatformAdminGuard(platformAccess);
    const tenantPlugin = new TenantPluginGuard(platformAccess);

    vApi.use(AUTH, new AuthRouter(this.manager, this.auth).router);
    vApi.use(PLUGINS, pluginAssetRouter);
    vApi.use(PLUGINS, new PluginRouter(this.manager, this.auth, platformAdmin).router);
    vApi.use(PLUGINS, new PluginSettingsRouter(this.manager, this.auth, tenantPlugin).router);
    vApi.use(PLUGINS, this.pluginRouter);
    vApi.use(MARKETPLACE, new MarketplaceRouter(this.manager, this.auth, platformAdmin).router);
    vApi.use(THEMES, themeAssetRouter);
    vApi.use(THEMES, new ThemeRouter(this.themeManager, this.auth, platformAdmin).router);
    vApi.use(APPEARANCES, new AppearanceRouter(this.auth, platformAdmin, platformAccess, (this.manager as any).schemaDb ?? this.manager.db).router);
    // Sources is framework surface, mounted like every other framework router. It used to arrive as
    // a "plugin" the framework discovered, packed into a tarball and loaded through a capability
    // sandbox — to build the very extensions that sandbox exists to contain.
    vApi.use(SOURCES, SourcesModule.install({
      // Blank resolves to `<project root>/data/sources` inside the module; the operator can point it
      // elsewhere in Settings, and nothing here invents a path.
      workspaceRoot: await PlatformSettingsService.resolve(
        process.env.SOURCES_WORKSPACE_ROOT,
        PlatformSettingsService.KEY.SOURCES_WORKSPACE_ROOT,
        '',
      ),
      db: this.manager.db,
      hooks: this.manager.hooks,
      adminGuard: this.auth.guard(['admin']),
      projectRoot: (this.manager as any).projectRoot,
      installer: this.manager,
      catalog: {
        contribute: (provider) => CoreServices.getInstance().catalogContributions.register({
          namespace: 'org.fromcode',
          pluginSlug: 'sources',
          list: provider as never,
        }),
      },
      scheduler: this.manager.scheduler,
    }).router);
    this.registerCoreExtensionRoutes(vApi);
    vApi.use(SYSTEM, new SystemRouter(this.manager, this.themeManager, this.auth, this.restController, platformAdmin).router);
    // Tenant provisioning (T4): platform admins only, on the owner connection. Mounted under SYSTEM
    // at its own prefix so its `/:id` never shadows a system route.
    const uploadsDir = ServerUploadsConfigService.resolve((this.manager as any).projectRoot || process.cwd(), this.mediaManager ?? undefined).uploadDir;
    vApi.use(`${SYSTEM}${RouteConstants.SEGMENTS.ADMIN_TENANTS}`, new TenantAdminRouter(this.manager, this.themeManager, uploadsDir, this.auth, platformAdmin).router);
    // SCIM 2.0 provisioning — token-authenticated (not session), mounted at the standard /scim/v2 base.
    vApi.use(RouteConstants.SEGMENTS.SCIM_BASE, new ScimRouter(this.manager, this.auth).router);
    vApi.use(MEDIA, new MediaRouter(this.manager, this.auth, this.mediaManager).router);
    vApi.use(FILES, new FilesRouter(this.manager, this.auth, this.mediaManager, this.settingsCache).router);
    vApi.use(VERSIONS, new VersioningRouter(this.manager, this.auth, this.restController).router);

    // The generic MCP surface. Token-authenticated only (see `AuthManager.requireApiToken`), reading
    // the ONE shared registry so the stdio transport, the hosted transport and the in-process Admin
    // Assistant can never disagree about which tools exist.
    vApi.use(McpRouter.create({
      registry: McpFrameworkToolsRegistrar.ensure({ db: (this.manager as any).db, mediaManager: this.mediaManager, settingsCache: this.settingsCache, hooks: this.manager.hooks, logger: this.logger }),
      // The platform's OWN checker, not a hand-rolled match. An earlier version compared
      // `getUserPermissions().includes(permission)`, which cannot understand the wildcard grants the
      // roles table actually stores — the admin role holds `*`, so a full admin was refused every
      // tool. Unit tests injected a stub checker and never saw it; the first real request did.
      permissions: new UserPermissionChecker((this.manager as any).db),
      audit: new McpAuditRecorder(this.logger, this.manager.audit),
      db: (this.manager as any).db,
      auth: this.auth,
      settingsCache: this.settingsCache,
      tenants: new TenantRegistryService((this.manager as any).db, TenantResolverService.shared((this.manager as any).db)),
      memberships: new TenantMembershipService((this.manager as any).db),
    }));

    // The platform gateway's host → app map (T6). Secret-only; see RoutingRouter.
    vApi.use(new RoutingRouter(new TenantRegistryService((this.manager as any).db, TenantResolverService.shared((this.manager as any).db))).router);
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
