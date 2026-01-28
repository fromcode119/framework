import express from 'express';
import { AuthManager } from '@fromcode/auth';
import { PluginManager, ThemeManager } from '@fromcode/core';
import { RESTController } from '../rest-controller';
import { SystemController } from '../controllers/SystemController';

export function setupSystemRoutes(manager: PluginManager, themeManager: ThemeManager, auth: AuthManager, restController: RESTController) {
  const router = express.Router();
  const controller = new SystemController(manager, themeManager, restController);

  router.get('/admin/plugins', auth.guard(['admin']), (req, res) => controller.getAdminMetadata(req, res));
  router.get('/admin/stats/collections', auth.guard(['admin']), (req, res) => controller.getStats(req, res));
  router.get('/admin/activity', auth.guard(['admin']), (req, res) => controller.getActivity(req, res));
  router.get('/admin/logs', auth.guard(['admin']), (req, res) => controller.getLogs(req, res));
  router.get('/admin/roles', auth.guard(['admin']), (req, res) => controller.getRoles(req, res));
  router.post('/admin/roles', auth.guard(['admin']), (req, res) => controller.saveRole(req, res));
  router.get('/admin/roles/:slug', auth.guard(['admin']), (req, res) => controller.getRole(req, res));
  router.put('/admin/roles/:slug', auth.guard(['admin']), (req, res) => controller.saveRole(req, res));
  router.delete('/admin/roles/:slug', auth.guard(['admin']), (req, res) => controller.deleteRole(req, res));
  router.get('/admin/permissions', auth.guard(['admin']), (req, res) => controller.getPermissions(req, res));
  router.post('/admin/permissions', auth.guard(['admin']), (req, res) => controller.savePermission(req, res));
  router.get('/admin/users', auth.guard(['admin']), (req, res) => controller.getUsers(req, res));
  router.post('/admin/users', auth.guard(['admin']), (req, res) => controller.saveUser(req, res));
  router.get('/admin/users/:id', auth.guard(['admin']), (req, res) => controller.getUser(req, res));
  router.put('/admin/users/:id', auth.guard(['admin']), (req, res) => controller.saveUser(req, res));
  router.delete('/admin/users/:id', auth.guard(['admin']), (req, res) => controller.deleteUser(req, res));
  router.post('/admin/users/roles', auth.guard(['admin']), (req, res) => controller.saveUserRoles(req, res));
  
  router.get('/update/check', auth.guard(['admin']), (req, res) => controller.checkUpdate(req, res));
  router.post('/update/apply', auth.guard(['admin']), (req, res) => controller.applyUpdate(req, res));

  router.get('/frontend', (req, res) => controller.getFrontendMetadata(req, res));
  router.get('/i18n', (req, res) => controller.getI18n(req, res));

  return router;
}

