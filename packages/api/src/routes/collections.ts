import express from 'express';
import { PluginManager } from '@fromcode/core';
import { RESTController } from '../controllers/RESTController';
import { createCollectionMiddleware } from '../middlewares/collection';

export function setupCollectionRoutes(manager: PluginManager, restController: RESTController) {
  const router = express.Router();
  const collectionMiddleware = createCollectionMiddleware(manager);

  router.get('/collections/:slug', collectionMiddleware, (req: any, res) => restController.find(req.collection, req, res));
  router.get('/collections/:slug/export', collectionMiddleware, (req: any, res) => restController.export(req.collection, req, res));
  router.post('/collections/:slug/import', collectionMiddleware, (req: any, res) => restController.import(req.collection, req, res));
  router.post('/collections/:slug/bulk', collectionMiddleware, (req: any, res) => restController.bulkCreate(req.collection, req, res));
  router.post('/collections/:slug/bulk-update', collectionMiddleware, (req: any, res) => restController.bulkUpdate(req.collection, req, res));
  router.post('/collections/:slug/bulk-delete', collectionMiddleware, (req: any, res) => restController.bulkDelete(req.collection, req, res));
  router.get('/collections/:slug/suggestions/:field', collectionMiddleware, (req: any, res) => restController.getSuggestions(req.collection, req, res));
  router.get('/collections/:slug/:id', collectionMiddleware, (req: any, res) => restController.findOne(req.collection, req, res));
  router.post('/collections/:slug', collectionMiddleware, (req: any, res) => restController.create(req.collection, req, res));
  router.put('/collections/:slug/:id', collectionMiddleware, (req: any, res) => restController.update(req.collection, req, res));
  router.delete('/collections/:slug/:id', collectionMiddleware, (req: any, res) => restController.delete(req.collection, req, res));

  return router;
}

export function setupLegacyCollectionRoutes(manager: PluginManager, restController: RESTController) {
  const router = express.Router();
  const collectionMiddleware = createCollectionMiddleware(manager);

  router.get('/:slug', collectionMiddleware, (req: any, res) => restController.find(req.collection, req, res));
  router.get('/:slug/export', collectionMiddleware, (req: any, res) => restController.export(req.collection, req, res));
  router.post('/:slug/import', collectionMiddleware, (req: any, res) => restController.import(req.collection, req, res));
  router.post('/:slug/bulk', collectionMiddleware, (req: any, res) => restController.bulkCreate(req.collection, req, res));
  router.post('/:slug/bulk-update', collectionMiddleware, (req: any, res) => restController.bulkUpdate(req.collection, req, res));
  router.post('/:slug/bulk-delete', collectionMiddleware, (req: any, res) => restController.bulkDelete(req.collection, req, res));
  router.get('/:slug/suggestions/:field', collectionMiddleware, (req: any, res) => restController.getSuggestions(req.collection, req, res));
  router.get('/:slug/:id', collectionMiddleware, (req: any, res) => restController.findOne(req.collection, req, res));
  router.post('/:slug', collectionMiddleware, (req: any, res) => restController.create(req.collection, req, res));
  router.put('/:slug/:id', collectionMiddleware, (req: any, res) => restController.update(req.collection, req, res));
  router.delete('/:slug/:id', collectionMiddleware, (req: any, res) => restController.delete(req.collection, req, res));

  return router;
}
