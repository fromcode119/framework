import express from 'express';
import { AuthManager } from '@fromcode/auth';
import { PluginManager } from '@fromcode/core';
import { PluginSettingsController } from '../controllers/PluginSettingsController';

export function setupPluginSettingsRoutes(manager: PluginManager, auth: AuthManager) {
  const router = express.Router();
  const controller = new PluginSettingsController(manager);

  // All settings routes require admin guards
  router.get('/:slug/settings', auth.guard(['admin']), (req, res) =>
    controller.getSettings(req, res)
  );
  
  router.put('/:slug/settings', auth.guard(['admin']), (req, res) =>
    controller.updateSettings(req, res)
  );
  
  router.get('/:slug/settings/schema', auth.guard(['admin']), (req, res) =>
    controller.getSchema(req, res)
  );
  
  router.post('/:slug/settings/reset', auth.guard(['admin']), (req, res) =>
    controller.resetSettings(req, res)
  );
  
  router.get('/:slug/settings/export', auth.guard(['admin']), (req, res) =>
    controller.exportSettings(req, res)
  );
  
  router.post('/:slug/settings/import', auth.guard(['admin']), (req, res) =>
    controller.importSettings(req, res)
  );

  return router;
}
