import express from 'express';
import multer from 'multer';
import { AuthManager } from '@fromcode/auth';
import { PluginManager } from '@fromcode/core';
import { PluginController } from '../controllers/PluginController';

export function setupPluginRoutes(manager: PluginManager, auth: AuthManager) {
  const router = express.Router();
  const controller = new PluginController(manager);
  const upload = multer({ dest: '/tmp/plugin-uploads' });

  router.get('/', auth.guard(['admin']), (req, res) => controller.list(req, res));
  router.get('/active', (req, res) => controller.active(req, res));
  router.post('/:slug/toggle', auth.guard(['admin']), (req, res) => controller.toggle(req, res));
  router.get('/:slug/config', auth.guard(['admin']), (req, res) => controller.getConfig(req, res));
  router.post('/:slug/config', auth.guard(['admin']), (req, res) => controller.saveConfig(req, res));
  router.post('/:slug/sandbox', auth.guard(['admin']), (req, res) => controller.saveSandboxConfig(req, res));
  router.delete('/:slug', auth.guard(['admin']), (req, res) => controller.delete(req, res));
  router.get('/marketplace', auth.guard(['admin']), (req, res) => controller.marketplace(req, res));
  router.post('/install/:slug', auth.guard(['admin']), (req, res) => controller.install(req, res));
  router.get('/:slug/logs', auth.guard(['admin']), (req, res) => controller.logs(req, res));
  router.post('/upload', auth.guard(['admin']), upload.single('plugin'), (req, res) => controller.upload(req, res));

  return router;
}

export function setupPluginAssetRoutes(manager: PluginManager) {
  const router = express.Router();
  const controller = new PluginController(manager);

  router.get('/:slug/ui/*', (req, res) => controller.serveAssets(req, res));

  return router;
}

