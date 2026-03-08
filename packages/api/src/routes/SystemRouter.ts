import { BaseRouter } from '../routers/BaseRouter';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager, ThemeManager } from '@fromcode119/core';
import { RESTController } from '../controllers/rest-controller';
import { SystemController } from '../controllers/system-controller';

/**
 * System management router.
 * 
 * Handles all system-level endpoints:
 * - Admin metadata and statistics
 * - Integration management
 * - User and role management
 * - Audit logs and activity
 * - Frontend metadata and i18n
 * - Shortcodes and data sources
 * 
 * @example
 * ```typescript
 * const systemRouter = new SystemRouter(pluginManager, themeManager, authManager, restController);
 * app.use('/api/v1/system', systemRouter.router);
 * ```
 */
export class SystemRouter extends BaseRouter {
  private controller: SystemController;
  private auth: AuthManager;

  constructor(
    manager: PluginManager,
    themeManager: ThemeManager,
    auth: AuthManager,
    restController: RESTController
  ) {
    super();
    this.auth = auth;
    this.controller = new SystemController(manager, themeManager, restController, auth);
  }

  protected registerRoutes(): void {
    // Admin metadata and stats
    this.get('/admin/metadata', this.auth.requirePermission('system:view'), 
      this.bind(this.controller.getAdminMetadata));
    this.get('/admin/stats/collections', this.auth.requirePermission('system:view'), 
      this.bind(this.controller.getStats));
    this.get('/admin/stats/security', this.auth.requirePermission('system:view'), 
      this.bind(this.controller.getSecurityStats));
    
    // Integration management
    this.get('/admin/integrations', this.auth.requirePermission('integrations:view'), 
      this.bind(this.controller.getIntegrations));
    this.get('/admin/integrations/:type', this.auth.requirePermission('integrations:view'), 
      this.bind(this.controller.getIntegration));
    this.put('/admin/integrations/:type', this.auth.requirePermission('integrations:manage'), 
      this.bind(this.controller.updateIntegration));
    this.patch('/admin/integrations/:type/providers/:providerId', 
      this.auth.requirePermission('integrations:manage'), 
      this.bind(this.controller.setIntegrationProviderEnabled));
    this.delete('/admin/integrations/:type/providers/:providerId', 
      this.auth.requirePermission('integrations:manage'), 
      this.bind(this.controller.removeIntegrationProvider));
    this.post('/admin/integrations/:type/profiles/:profileId/activate', 
      this.auth.requirePermission('integrations:manage'), 
      this.bind(this.controller.activateIntegrationProfile));
    this.patch('/admin/integrations/:type/profiles/:profileId', 
      this.auth.requirePermission('integrations:manage'), 
      this.bind(this.controller.renameIntegrationProfile));
    this.delete('/admin/integrations/:type/profiles/:profileId', 
      this.auth.requirePermission('integrations:manage'), 
      this.bind(this.controller.deleteIntegrationProfile));
    
    // Telemetry and monitoring
    this.post('/admin/telemetry/email-test', this.auth.requirePermission('system:view'), 
      this.bind(this.controller.sendTestTelemetryEmail));
    this.get('/admin/activity', this.auth.requirePermission('system:view'), 
      this.bind(this.controller.getActivity));
    this.get('/admin/logs', this.auth.requirePermission('system:logs'), 
      this.bind(this.controller.getLogs));
    this.get('/admin/audit', this.auth.requirePermission('system:audit'), 
      this.bind(this.controller.getAuditLogs));
    
    // Role management
    this.get('/admin/roles', this.auth.requirePermission('roles:view'), 
      this.bind(this.controller.getRoles));
    this.post('/admin/roles', this.auth.requirePermission('roles:manage'), 
      this.bind(this.controller.saveRole));
    this.get('/admin/roles/:slug', this.auth.requirePermission('roles:view'), 
      this.bind(this.controller.getRole));
    this.put('/admin/roles/:slug', this.auth.requirePermission('roles:manage'), 
      this.bind(this.controller.saveRole));
    this.delete('/admin/roles/:slug', this.auth.requirePermission('roles:manage'), 
      this.bind(this.controller.deleteRole));
    this.get('/admin/permissions', this.auth.requirePermission('roles:view'), 
      this.bind(this.controller.getPermissions));
    this.post('/admin/permissions', this.auth.requirePermission('roles:manage'), 
      this.bind(this.controller.savePermission));
    
    // User management
    this.get('/admin/users', this.auth.requirePermission('users:view'), 
      this.bind(this.controller.getUsers));
    this.post('/admin/users', this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.saveUser));
    this.get('/admin/users/:id', this.auth.requirePermission('users:view'), 
      this.bind(this.controller.getUser));
    this.put('/admin/users/:id', this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.saveUser));
    this.delete('/admin/users/:id', this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.deleteUser));
    this.post('/admin/users/roles', this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.saveUserRoles));
    
    // 2FA Management
    this.get('/admin/users/:id/2fa/status', this.auth.requirePermission('users:view'), 
      this.bind(this.controller.getTwoFactorStatus));
    this.post('/admin/users/:id/2fa/setup', this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.setup2FA));
    this.post('/admin/users/:id/2fa/verify', this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.verify2FA));
    this.post('/admin/users/:id/2fa/recovery-codes/regenerate', 
      this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.regenerateRecoveryCodes));
    this.delete('/admin/users/:id/2fa', this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.disable2FA));
    
    // System updates
    this.get('/update/check', this.auth.requirePermission('system:update'), 
      this.bind(this.controller.checkUpdate));
    this.post('/update/apply', this.auth.requirePermission('system:update'), 
      this.bind(this.controller.applyUpdate));
    
    // Public/frontend endpoints
    this.get('/events', this.auth.guard(), this.bind(this.controller.getEvents));
    this.get('/frontend', this.bind(this.controller.getFrontendMetadata));
    this.get('/i18n', this.bind(this.controller.getI18n));
    
    // Content features
    this.get('/shortcodes', this.auth.requirePermission('content:read'), 
      this.bind(this.controller.getShortcodes));
    this.get('/data-sources', this.auth.requirePermission('content:read'), 
      this.bind(this.controller.getDataSources));
    this.get('/data-source/query', this.auth.requirePermission('content:read'), 
      this.bind(this.controller.queryDataSource));
    this.post('/data-source/query', this.auth.requirePermission('content:read'), 
      this.bind(this.controller.queryDataSource));
    this.post('/shortcodes/render', this.auth.requirePermission('content:read'), 
      this.bind(this.controller.renderShortcodes));
    this.get('/resolve', this.bind(this.controller.resolveSlug));
  }
}
