import { BaseRouter } from '../routers/base-router';
import { PluginManager } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { RESTController } from '../controllers/rest-controller';
import { CollectionMiddleware } from '../middlewares/collection-middleware';
import { RouteConstants } from '@fromcode119/sdk';

/**
 * Collection versioning routes (history / restore).
 */
export class VersioningRouter extends BaseRouter {
  private collectionMiddleware: ReturnType<CollectionMiddleware['middleware']>;

  constructor(
    private manager: PluginManager,
    private auth: AuthManager,
    private restController: RESTController
  ) {
    super();
    this.collectionMiddleware = new CollectionMiddleware(manager).middleware();
  }

  protected registerRoutes(): void {
    const isAdmin = this.auth.guard(['admin']);

    this.get(RouteConstants.SEGMENTS.COLLECTIONS_SLUG_ID, isAdmin, this.collectionMiddleware, (req: any, res) =>
      this.restController.getVersions(req.collection, req, res));

    this.get(RouteConstants.SEGMENTS.COLLECTIONS_SLUG_ID_VERSION, isAdmin, this.collectionMiddleware, (req: any, res) =>
      this.restController.getVersion(req.collection, req, res));

    this.post(RouteConstants.SEGMENTS.COLLECTIONS_SLUG_ID_VERSION_RESTORE, isAdmin, this.collectionMiddleware, (req: any, res) =>
      this.restController.restoreVersion(req.collection, req, res));
  }
}