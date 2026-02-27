import express from 'express';
import multer from 'multer';
import { AuthManager } from '@fromcode119/auth';
import { ThemeManager } from '@fromcode119/core';
import { ThemeController } from '../controllers/theme-controller';

export function setupThemeRoutes(manager: ThemeManager, auth: AuthManager) {
  const router = express.Router();
  const controller = new ThemeController(manager);
  const upload = multer({ dest: '/tmp/theme-uploads' });

  router.get('/', auth.guard(['admin']), (req, res) => controller.list(req, res));
  router.get('/marketplace', auth.guard(['admin']), (req, res) => controller.getMarketplace(req, res));
  router.get('/:slug/check-update', auth.guard(['admin']), (req, res) => controller.checkUpdate(req, res));
  router.get('/:slug/activate', auth.guard(['admin']), (req, res) => controller.activate(req, res));
  router.post('/:slug/activate', auth.guard(['admin']), (req, res) => controller.activate(req, res));
  router.post('/:slug/reset', auth.guard(['admin']), (req, res) => controller.reset(req, res));
  router.post('/:slug/install', auth.guard(['admin']), (req, res) => controller.install(req, res));
  router.post('/upload/inspect', auth.guard(['admin']), upload.single('theme'), (req, res) => controller.inspectUpload(req, res));
  router.post('/upload', auth.guard(['admin']), upload.single('theme'), (req, res) => controller.upload(req, res));
  router.get('/:slug/config', auth.guard(['admin']), (req, res) => controller.getConfig(req, res));
  router.post('/:slug/config', auth.guard(['admin']), (req, res) => controller.saveConfig(req, res));
  router.delete('/:slug', auth.guard(['admin']), (req, res) => controller.delete(req, res));

  return router;
}

export function setupThemeAssetRoutes(manager: ThemeManager) {
  const router = express.Router();
  const controller = new ThemeController(manager);

  router.get('/:slug/ui/*', (req, res) => controller.serveAssets(req, res));

  return router;
}
