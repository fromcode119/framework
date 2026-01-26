import express from 'express';
import { AuthManager } from '@fromcode/auth';
import { PluginManager } from '@fromcode/core';
import { RESTController } from '../rest-controller';
import { SystemController } from '../controllers/SystemController';

export function setupSystemRoutes(manager: PluginManager, auth: AuthManager, restController: RESTController) {
  const router = express.Router();
  const controller = new SystemController(manager, restController);

  router.get('/admin/plugins', auth.guard(['admin']), (req, res) => controller.getAdminMetadata(req, res));
  router.get('/admin/stats/collections', auth.guard(['admin']), (req, res) => controller.getStats(req, res));
  router.get('/admin/activity', auth.guard(['admin']), (req, res) => controller.getActivity(req, res));
  router.get('/admin/logs', auth.guard(['admin']), (req, res) => controller.getLogs(req, res));
  router.get('/i18n', (req, res) => controller.getI18n(req, res));

  return router;
}

