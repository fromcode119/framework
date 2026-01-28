import express from 'express';
import { AuthManager } from '@fromcode/auth';
import { ThemeManager } from '@fromcode/core';
import { ThemeController } from '../controllers/ThemeController';

export function setupThemeRoutes(manager: ThemeManager, auth: AuthManager) {
  const router = express.Router();
  const controller = new ThemeController(manager);

  router.get('/', auth.guard(['admin']), (req, res) => controller.list(req, res));
  router.get('/registry', auth.guard(['admin']), (req, res) => controller.getRegistry(req, res));
  router.post('/:slug/activate', auth.guard(['admin']), (req, res) => controller.activate(req, res));
  router.post('/:slug/install', auth.guard(['admin']), (req, res) => controller.install(req, res));
  router.delete('/:slug', auth.guard(['admin']), (req, res) => controller.delete(req, res));

  return router;
}

export function setupThemeAssetRoutes(manager: ThemeManager) {
  const router = express.Router();
  const controller = new ThemeController(manager);

  router.get('/:slug/ui/*', (req, res) => controller.serveAssets(req, res));

  return router;
}
