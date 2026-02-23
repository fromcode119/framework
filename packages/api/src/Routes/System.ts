import express from 'express';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager, ThemeManager } from '@fromcode119/core';
import { RESTController } from '../controllers/rest-controller';
import { SystemController } from '../controllers/system-controller';

export function setupSystemRoutes(manager: PluginManager, themeManager: ThemeManager, auth: AuthManager, restController: RESTController) {
  const router = express.Router();
  const controller = new SystemController(manager, themeManager, restController);

  router.get('/admin/metadata', auth.requirePermission('system:view'), (req, res) => controller.getAdminMetadata(req, res));
  router.get('/admin/integrations', auth.requirePermission('integrations:view'), (req, res) => controller.getIntegrations(req, res));
  router.get('/admin/integrations/:type', auth.requirePermission('integrations:view'), (req, res) => controller.getIntegration(req, res));
  router.put('/admin/integrations/:type', auth.requirePermission('integrations:manage'), (req, res) => controller.updateIntegration(req, res));
  router.patch('/admin/integrations/:type/providers/:providerId', auth.requirePermission('integrations:manage'), (req, res) => controller.setIntegrationProviderEnabled(req, res));
  router.delete('/admin/integrations/:type/providers/:providerId', auth.requirePermission('integrations:manage'), (req, res) => controller.removeIntegrationProvider(req, res));
  router.post('/admin/integrations/:type/profiles/:profileId/activate', auth.requirePermission('integrations:manage'), (req, res) => controller.activateIntegrationProfile(req, res));
  router.patch('/admin/integrations/:type/profiles/:profileId', auth.requirePermission('integrations:manage'), (req, res) => controller.renameIntegrationProfile(req, res));
  router.delete('/admin/integrations/:type/profiles/:profileId', auth.requirePermission('integrations:manage'), (req, res) => controller.deleteIntegrationProfile(req, res));
  router.get('/admin/stats/collections', auth.requirePermission('system:view'), (req, res) => controller.getStats(req, res));
  router.get('/admin/stats/security', auth.requirePermission('system:view'), (req, res) => controller.getSecurityStats(req, res));
  router.post('/admin/telemetry/email-test', auth.requirePermission('system:view'), (req, res) => controller.sendTestTelemetryEmail(req, res));
  router.get('/admin/activity', auth.requirePermission('system:view'), (req, res) => controller.getActivity(req, res));
  router.get('/admin/logs', auth.requirePermission('system:logs'), (req, res) => controller.getLogs(req, res));
  router.get('/admin/audit', auth.requirePermission('system:audit'), (req, res) => controller.getAuditLogs(req, res));
  router.get('/admin/roles', auth.requirePermission('roles:view'), (req, res) => controller.getRoles(req, res));
  router.post('/admin/roles', auth.requirePermission('roles:manage'), (req, res) => controller.saveRole(req, res));
  router.get('/admin/roles/:slug', auth.requirePermission('roles:view'), (req, res) => controller.getRole(req, res));
  router.put('/admin/roles/:slug', auth.requirePermission('roles:manage'), (req, res) => controller.saveRole(req, res));
  router.delete('/admin/roles/:slug', auth.requirePermission('roles:manage'), (req, res) => controller.deleteRole(req, res));
  router.get('/admin/permissions', auth.requirePermission('roles:view'), (req, res) => controller.getPermissions(req, res));
  router.post('/admin/permissions', auth.requirePermission('roles:manage'), (req, res) => controller.savePermission(req, res));
  router.get('/admin/users', auth.requirePermission('users:view'), (req, res) => controller.getUsers(req, res));
  router.post('/admin/users', auth.requirePermission('users:manage'), (req, res) => controller.saveUser(req, res));
  router.get('/admin/users/:id', auth.requirePermission('users:view'), (req, res) => controller.getUser(req, res));
  router.put('/admin/users/:id', auth.requirePermission('users:manage'), (req, res) => controller.saveUser(req, res));
  router.delete('/admin/users/:id', auth.requirePermission('users:manage'), (req, res) => controller.deleteUser(req, res));
  router.post('/admin/users/roles', auth.requirePermission('users:manage'), (req, res) => controller.saveUserRoles(req, res));
  
  // 2FA Management Routes
  router.get('/admin/users/:id/2fa/status', auth.requirePermission('users:view'), (req, res) => controller.getTwoFactorStatus(req, res));
  router.post('/admin/users/:id/2fa/setup', auth.requirePermission('users:manage'), (req, res) => controller.setup2FA(req, res));
  router.post('/admin/users/:id/2fa/verify', auth.requirePermission('users:manage'), (req, res) => controller.verify2FA(req, res));
  router.post('/admin/users/:id/2fa/recovery-codes/regenerate', auth.requirePermission('users:manage'), (req, res) => controller.regenerateRecoveryCodes(req, res));
  router.delete('/admin/users/:id/2fa', auth.requirePermission('users:manage'), (req, res) => controller.disable2FA(req, res));
  
  router.get('/update/check', auth.requirePermission('system:update'), (req, res) => controller.checkUpdate(req, res));
  router.post('/update/apply', auth.requirePermission('system:update'), (req, res) => controller.applyUpdate(req, res));

  router.get('/events', auth.guard(), (req, res) => controller.getEvents(req, res));
  router.get('/frontend', (req, res) => controller.getFrontendMetadata(req, res));
  router.get('/i18n', (req, res) => controller.getI18n(req, res));
  router.get('/shortcodes', auth.requirePermission('content:read'), (req, res) => controller.getShortcodes(req, res));
  router.get('/data-sources', auth.requirePermission('content:read'), (req, res) => controller.getDataSources(req, res));
  router.get('/data-source/query', auth.requirePermission('content:read'), (req, res) => controller.queryDataSource(req, res));
  router.post('/data-source/query', auth.requirePermission('content:read'), (req, res) => controller.queryDataSource(req, res));
  router.post('/shortcodes/render', auth.requirePermission('content:read'), (req, res) => controller.renderShortcodes(req, res));
  router.get('/resolve', (req, res) => controller.resolveSlug(req, res));

  return router;
}
