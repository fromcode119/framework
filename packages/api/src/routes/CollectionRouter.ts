import { BaseRouter } from '../routers/BaseRouter';
import { PluginManager } from '@fromcode119/core';
import { RESTController } from '../controllers/rest-controller';
import { CollectionMiddleware } from '../middlewares/CollectionMiddleware';

/**
 * Collection router for CRUD operations on collections.
 * 
 * Handles all collection-related endpoints with /collections prefix.
 * Automatically loads collection metadata via middleware.
 * 
 * @example
 * ```typescript
 * const collectionRouter = new CollectionRouter(pluginManager, restController);
 * app.use('/api/v1', collectionRouter.router);
 * ```
 */
export class CollectionRouter extends BaseRouter {
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
    this.get('/collections/:slug', this.collectionMiddleware, 
      (req: any, res) => this.restController.find(req.collection, req, res));
    this.get('/collections/:slug/export', this.collectionMiddleware, 
      (req: any, res) => this.restController.export(req.collection, req, res));
    
    // Import and bulk operations
    this.post('/collections/:slug/import', this.collectionMiddleware, 
      (req: any, res) => this.restController.import(req.collection, req, res));
    this.post('/collections/:slug/bulk', this.collectionMiddleware, 
      (req: any, res) => this.restController.bulkCreate(req.collection, req, res));
    this.post('/collections/:slug/bulk-update', this.collectionMiddleware, 
      (req: any, res) => this.restController.bulkUpdate(req.collection, req, res));
    this.post('/collections/:slug/bulk-delete', this.collectionMiddleware, 
      (req: any, res) => this.restController.bulkDelete(req.collection, req, res));
    
    // Field suggestions
    this.get('/collections/:slug/suggestions/:field', this.collectionMiddleware, 
      (req: any, res) => this.restController.getSuggestions(req.collection, req, res));
    
    // CRUD operations
    this.get('/collections/:slug/:id', this.collectionMiddleware, 
      (req: any, res) => this.restController.findOne(req.collection, req, res));
    this.post('/collections/:slug', this.collectionMiddleware, 
      (req: any, res) => this.restController.create(req.collection, req, res));
    this.put('/collections/:slug/:id', this.collectionMiddleware, 
      (req: any, res) => this.restController.update(req.collection, req, res));
    this.delete('/collections/:slug/:id', this.collectionMiddleware, 
      (req: any, res) => this.restController.delete(req.collection, req, res));
  }
}

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
    this.get('/:slug', this.collectionMiddleware, 
      (req: any, res) => this.restController.find(req.collection, req, res));
    this.get('/:slug/export', this.collectionMiddleware, 
      (req: any, res) => this.restController.export(req.collection, req, res));
    
    // Import and bulk operations
    this.post('/:slug/import', this.collectionMiddleware, 
      (req: any, res) => this.restController.import(req.collection, req, res));
    this.post('/:slug/bulk', this.collectionMiddleware, 
      (req: any, res) => this.restController.bulkCreate(req.collection, req, res));
    this.post('/:slug/bulk-update', this.collectionMiddleware, 
      (req: any, res) => this.restController.bulkUpdate(req.collection, req, res));
    this.post('/:slug/bulk-delete', this.collectionMiddleware, 
      (req: any, res) => this.restController.bulkDelete(req.collection, req, res));
    
    // Field suggestions
    this.get('/:slug/suggestions/:field', this.collectionMiddleware, 
      (req: any, res) => this.restController.getSuggestions(req.collection, req, res));
    
    // CRUD operations
    this.get('/:slug/:id', this.collectionMiddleware, 
      (req: any, res) => this.restController.findOne(req.collection, req, res));
    this.post('/:slug', this.collectionMiddleware, 
      (req: any, res) => this.restController.create(req.collection, req, res));
    this.put('/:slug/:id', this.collectionMiddleware, 
      (req: any, res) => this.restController.update(req.collection, req, res));
    this.delete('/:slug/:id', this.collectionMiddleware, 
      (req: any, res) => this.restController.delete(req.collection, req, res));
  }
}
