import express from 'express';
import { PluginManager } from '@fromcode/core';
import { AuthManager } from '@fromcode/auth';
import { RESTController } from '../controllers/RESTController';
import { createCollectionMiddleware } from '../middlewares/collection';

export function setupVersioningRoutes(manager: PluginManager, auth: AuthManager, restController: RESTController) {
  const router = express.Router();
  const collectionMiddleware = createCollectionMiddleware(manager);
  const isAdmin = auth.guard(['admin']);

  router.get('/:slug/:id', isAdmin, collectionMiddleware, (req: any, res) => restController.getVersions(req.collection, req, res));
  router.get('/:slug/:id/:version', isAdmin, collectionMiddleware, (req: any, res) => restController.getVersion(req.collection, req, res));
  router.post('/:slug/:id/:version/restore', isAdmin, collectionMiddleware, (req: any, res) => restController.restoreVersion(req.collection, req, res));

  return router;
}
