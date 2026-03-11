import { BaseRouter } from '../routers/base-router';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager, ThemeManager } from '@fromcode119/core';
import { RouteConstants } from '@fromcode119/sdk';
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
    this.get(RouteConstants.SEGMENTS.ADMIN_METADATA, this.auth.requirePermission('system:view'), 
      this.bind(this.controller.getAdminMetadata.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.ADMIN_STATS_COLLECTIONS, this.auth.requirePermission('system:view'), 
      this.bind(this.controller.getStats.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.ADMIN_STATS_SECURITY, this.auth.requirePermission('system:view'), 
      this.bind(this.controller.getSecurityStats.bind(this.controller)));
    
    // Integration management
    this.get(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS, this.auth.requirePermission('integrations:view'), 
      this.bind(this.controller.getIntegrations.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_TYPE, this.auth.requirePermission('integrations:view'), 
      this.bind(this.controller.getIntegration.bind(this.controller)));
    this.put(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_TYPE, this.auth.requirePermission('integrations:manage'), 
      this.bind(this.controller.updateIntegration.bind(this.controller)));
    this.patch(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROVIDER, 
      this.auth.requirePermission('integrations:manage'), 
      this.bind(this.controller.setIntegrationProviderEnabled.bind(this.controller)));
    this.delete(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROVIDER, 
      this.auth.requirePermission('integrations:manage'), 
      this.bind(this.controller.removeIntegrationProvider.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROFILE_ACTIVATE, 
      this.auth.requirePermission('integrations:manage'), 
      this.bind(this.controller.activateIntegrationProfile.bind(this.controller)));
    this.patch(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROFILE, 
      this.auth.requirePermission('integrations:manage'), 
      this.bind(this.controller.renameIntegrationProfile.bind(this.controller)));
    this.delete(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROFILE, 
      this.auth.requirePermission('integrations:manage'), 
      this.bind(this.controller.deleteIntegrationProfile.bind(this.controller)));
    
    // Telemetry and monitoring
    this.post(RouteConstants.SEGMENTS.ADMIN_TELEMETRY_EMAIL_TEST, this.auth.requirePermission('system:view'), 
      this.bind(this.controller.sendTestTelemetryEmail.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.ADMIN_ACTIVITY, this.auth.requirePermission('system:view'), 
      this.bind(this.controller.getActivity.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.ADMIN_LOGS, this.auth.requirePermission('system:logs'), 
      this.bind(this.controller.getLogs.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.ADMIN_AUDIT, this.auth.requirePermission('system:audit'), 
      this.bind(this.controller.getAuditLogs.bind(this.controller)));
    
    // Role management
    this.get(RouteConstants.SEGMENTS.ADMIN_ROLES, this.auth.requirePermission('roles:view'), 
      this.bind(this.controller.getRoles.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.ADMIN_ROLES, this.auth.requirePermission('roles:manage'), 
      this.bind(this.controller.saveRole.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.ADMIN_ROLES_SLUG, this.auth.requirePermission('roles:view'), 
      this.bind(this.controller.getRole.bind(this.controller)));
    this.put(RouteConstants.SEGMENTS.ADMIN_ROLES_SLUG, this.auth.requirePermission('roles:manage'), 
      this.bind(this.controller.saveRole.bind(this.controller)));
    this.delete(RouteConstants.SEGMENTS.ADMIN_ROLES_SLUG, this.auth.requirePermission('roles:manage'), 
      this.bind(this.controller.deleteRole.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.ADMIN_PERMISSIONS, this.auth.requirePermission('roles:view'), 
      this.bind(this.controller.getPermissions.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.ADMIN_PERMISSIONS, this.auth.requirePermission('roles:manage'), 
      this.bind(this.controller.savePermission.bind(this.controller)));
    
    // User management
    this.get(RouteConstants.SEGMENTS.ADMIN_USERS, this.auth.requirePermission('users:view'), 
      this.bind(this.controller.getUsers.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.ADMIN_USERS, this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.saveUser.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.ADMIN_USERS_ID, this.auth.requirePermission('users:view'), 
      this.bind(this.controller.getUser.bind(this.controller)));
    this.put(RouteConstants.SEGMENTS.ADMIN_USERS_ID, this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.saveUser.bind(this.controller)));
    this.delete(RouteConstants.SEGMENTS.ADMIN_USERS_ID, this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.deleteUser.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.ADMIN_USERS_ROLES, this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.saveUserRoles.bind(this.controller)));
    
    // 2FA Management
    this.get(RouteConstants.SEGMENTS.ADMIN_USERS_2FA_STATUS, this.auth.requirePermission('users:view'), 
      this.bind(this.controller.getTwoFactorStatus.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.ADMIN_USERS_2FA_SETUP, this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.setup2FA.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.ADMIN_USERS_2FA_VERIFY, this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.verify2FA.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.ADMIN_USERS_2FA_RECOVERY, 
      this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.regenerateRecoveryCodes.bind(this.controller)));
    this.delete(RouteConstants.SEGMENTS.ADMIN_USERS_2FA_DISABLE, this.auth.requirePermission('users:manage'), 
      this.bind(this.controller.disable2FA.bind(this.controller)));
    
    // System updates
    this.get(RouteConstants.SEGMENTS.UPDATE_CHECK, this.auth.requirePermission('system:update'), 
      this.bind(this.controller.checkUpdate.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.UPDATE_APPLY, this.auth.requirePermission('system:update'), 
      this.bind(this.controller.applyUpdate.bind(this.controller)));
    
    // Public/frontend endpoints
    this.get(RouteConstants.SEGMENTS.EVENTS, this.auth.guard(), this.bind(this.controller.getEvents.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.FRONTEND, this.bind(this.controller.getFrontendMetadata.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.I18N, this.bind(this.controller.getI18n.bind(this.controller)));
    
    // Content features
    this.get(RouteConstants.SEGMENTS.SHORTCODES, this.auth.requirePermission('content:read'), 
      this.bind(this.controller.getShortcodes.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.DATA_SOURCES, this.auth.requirePermission('content:read'), 
      this.bind(this.controller.getDataSources.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.DATA_SOURCE_QUERY, this.auth.requirePermission('content:read'), 
      this.bind(this.controller.queryDataSource.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.DATA_SOURCE_QUERY, this.auth.requirePermission('content:read'), 
      this.bind(this.controller.queryDataSource.bind(this.controller)));
    this.post(RouteConstants.SEGMENTS.SHORTCODES_RENDER, this.auth.requirePermission('content:read'), 
      this.bind(this.controller.renderShortcodes.bind(this.controller)));
    this.get(RouteConstants.SEGMENTS.RESOLVE, this.bind(this.controller.resolveSlug.bind(this.controller)));
  }
}