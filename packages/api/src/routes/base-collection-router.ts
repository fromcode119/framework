import { BaseRouter } from '../routers/base-router';
import { PluginManager } from '@fromcode119/core';
import { RESTController } from '../controllers/rest-controller';
import { CollectionMiddleware } from '../middlewares/collection-middleware';
import { RouteConstants } from '@fromcode119/sdk';

/**
 * Base collection router without /collections prefix.
 * Used for plugin-specific collection routes.
 * 
 * @example
 * ```typescript
 * const baseRouter = new BaseCollectionRouter(pluginManager, restController);
 * app.use('/api/v1/ecommerce', baseRouter.router);
 * ```
 */
export class BaseCollectionRouter extends BaseRouter {
  private collectionMiddleware: any;

  constructor(
    private manager: PluginManager,
    private restController: RESTController
  ) {
    super();
    this.collectionMiddleware = new CollectionMiddleware(manager).middleware();
  }

  protected registerRoutes(): void {
    // List and export
    this.get(RouteConstants.SEGMENTS.COLLECTIONS_SLUG, this.collectionMiddleware, 
      (req: any, res) => this.restController.find(req.collection, req, res));
    this.get(RouteConstants.SEGMENTS.COLLECTIONS_SLUG_EXPORT, this.collectionMiddleware, 
      (req: any, res) => this.restController.export(req.collection, req, res));
    
    // Import and bulk operations
    this.post(RouteConstants.SEGMENTS.COLLECTIONS_SLUG_IMPORT, this.collectionMiddleware, 
      (req: any, res) => this.restController.import(req.collection, req, res));
    this.post(RouteConstants.SEGMENTS.COLLECTIONS_SLUG_BULK, this.collectionMiddleware, 
      (req: any, res) => this.restController.bulkCreate(req.collection, req, res));
    this.post(RouteConstants.SEGMENTS.COLLECTIONS_SLUG_BULK_UPDATE, this.collectionMiddleware, 
      (req: any, res) => this.restController.bulkUpdate(req.collection, req, res));
    this.post(RouteConstants.SEGMENTS.COLLECTIONS_SLUG_BULK_DELETE, this.collectionMiddleware, 
      (req: any, res) => this.restController.bulkDelete(req.collection, req, res));
    
    // Field suggestions
    this.get(RouteConstants.SEGMENTS.COLLECTIONS_SLUG_SUGGESTIONS_FIELD, this.collectionMiddleware, 
      (req: any, res) => this.restController.getSuggestions(req.collection, req, res));
    
    // CRUD operations
    this.get(RouteConstants.SEGMENTS.COLLECTIONS_SLUG_ID, this.collectionMiddleware, 
      (req: any, res) => this.restController.findOne(req.collection, req, res));
    this.post(RouteConstants.SEGMENTS.COLLECTIONS_SLUG, this.collectionMiddleware, 
      (req: any, res) => this.restController.create(req.collection, req, res));
    this.put(RouteConstants.SEGMENTS.COLLECTIONS_SLUG_ID, this.collectionMiddleware, 
      (req: any, res) => this.restController.update(req.collection, req, res));
    this.delete(RouteConstants.SEGMENTS.COLLECTIONS_SLUG_ID, this.collectionMiddleware, 
      (req: any, res) => this.restController.delete(req.collection, req, res));
  }
}
