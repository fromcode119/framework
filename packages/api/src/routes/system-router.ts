import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';
import { BaseRouter } from '@fromcode119/core';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager, ThemeManager, RouteConstants, SystemRedirectService } from '@fromcode119/core';
import { RESTController } from '@api/controllers/rest/rest-controller';
import { SystemController } from '@api/controllers/system/system-controller';
import { SystemBackupController } from '@api/controllers/system/system-backup-controller';
import { SystemEmailPreferencesController } from '@api/controllers/system/system-email-preferences-controller';
import { SystemEmailPreferencesTokenController } from '@api/controllers/system/system-email-preferences-token-controller';
import { SystemRedirectsController } from '@api/controllers/system/system-redirects-controller';
import { SystemBackupRepository } from '@api/repositories/system-backup-repository';
import { SystemBackupService } from '@api/services/system-backup-service';
import { SystemPlatformRoutes } from '@api/routes/system-platform-routes';

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
export class SystemRouter extends SystemPlatformRoutes {
  protected auth: AuthManager;

  constructor(
    manager: PluginManager,
    themeManager: ThemeManager,
    auth: AuthManager,
    restController: RESTController,
    private readonly platformAdmin: PlatformAdminGuard,
  ) {
    super();
    this.auth = auth;
    const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-system-backup-'));
    const chunkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-system-backup-chunks-'));
    this.upload = multer({ dest: uploadsDir });
    this.chunkUpload = multer({ dest: chunkDir });
    this.controller = new SystemController(manager, themeManager, restController, auth);
    const backupRepository = new SystemBackupRepository((manager as any).db);
    const backupService = new SystemBackupService(backupRepository);
    this.backupController = new SystemBackupController(backupService);
    // Labels are i18n KEYS in the registry; resolve them here so the response is ready to render.
    const translate = (key: string, fallback: string) => (manager as any).i18n?.translateOrFallback?.(key, fallback) ?? fallback;
    this.emailPreferencesController = new SystemEmailPreferencesController(manager, translate);
    this.emailPreferencesTokenController = new SystemEmailPreferencesTokenController(manager, translate);
    // The redirect store service instance registered at boot is stateless beyond its db handle, so a
    // second instance over the same manager db is equivalent.
    this.redirectsController = new SystemRedirectsController(new SystemRedirectService((manager as any).db));
  }

  protected registerRoutes(): void {
    // Admin metadata: any authenticated user may fetch it — the admin client permission-scopes the nav
    // it renders (scoped operators see only their areas; a user with no admin permissions gets the
    // self-service account view). Stats below stay system:view (admin dashboards).
    this.get(RouteConstants.SEGMENTS.ADMIN_METADATA, this.auth.guard(),
      this.controller.getAdminMetadata);

    // A person's own email streams. `auth.guard()` (any authenticated user, not an admin permission):
    // this is self-service, and the controller reads the address off the SESSION, never the request.
    this.get(RouteConstants.SEGMENTS.EMAIL_PREFERENCES, this.auth.guard(),
      (req: any, res: any) => this.emailPreferencesController.list(req, res));
    this.post(RouteConstants.SEGMENTS.EMAIL_PREFERENCES, this.auth.guard(),
      (req: any, res: any) => this.emailPreferencesController.update(req, res));
    // The same surface, reached from a link in an email. No guard: most recipients have no account,
    // and the signed token is the credential. The controller derives the address from that token
    // alone, so an address in the query or body is ignored and cannot aim this at a stranger.
    this.get(RouteConstants.SEGMENTS.EMAIL_PREFERENCES_BY_TOKEN,
      (req: any, res: any) => this.emailPreferencesTokenController.list(req, res));
    this.post(RouteConstants.SEGMENTS.EMAIL_PREFERENCES_BY_TOKEN,
      (req: any, res: any) => this.emailPreferencesTokenController.update(req, res));
    // Global admin search (command palette). system:view — spans record labels across every collection.
    this.get(RouteConstants.SEGMENTS.ADMIN_SEARCH, this.auth.requirePermission('system:view'),
      this.controller.search);
    // In-app notification inbox — per-user, so any authenticated user (admins AND partners).
    this.get(RouteConstants.SEGMENTS.ADMIN_NOTIFICATIONS, this.auth.guard(),
      this.controller.getNotifications);
    // Webhooks: delivery log + test + resend (system:manage — outbound integration config).
    this.get(RouteConstants.SEGMENTS.ADMIN_WEBHOOKS, this.auth.requirePermission('system:view'),
      this.controller.getWebhooks);
    this.post(RouteConstants.SEGMENTS.ADMIN_WEBHOOKS_ID_TEST, this.auth.requirePermission('system:manage'),
      this.controller.testWebhook);
    this.post(RouteConstants.SEGMENTS.ADMIN_WEBHOOK_DELIVERIES_ID_RESEND, this.auth.requirePermission('system:manage'),
      this.controller.resendWebhookDelivery);
    // SCIM provisioning config: status (system:view) + rotate the bearer token (system:manage).
    this.get(RouteConstants.SEGMENTS.ADMIN_SCIM, this.auth.requirePermission('system:view'),
      this.controller.getScim);
    this.post(RouteConstants.SEGMENTS.ADMIN_SCIM_ROTATE, this.auth.requirePermission('system:manage'),
      this.controller.rotateScimToken);
    // Per-user UI preferences (saved views etc.) — key namespace embeds the user id.
    this.get(RouteConstants.SEGMENTS.ADMIN_PREFERENCES_KEY, this.auth.guard(),
      this.controller.getPreference);
    this.put(RouteConstants.SEGMENTS.ADMIN_PREFERENCES_KEY, this.auth.guard(),
      this.controller.setPreference);
    this.post(RouteConstants.SEGMENTS.ADMIN_NOTIFICATIONS_READ_ALL, this.auth.guard(),
      this.controller.markAllNotificationsRead);
    this.post(RouteConstants.SEGMENTS.ADMIN_NOTIFICATIONS_ID_READ, this.auth.guard(),
      this.controller.markNotificationRead);
    this.get(RouteConstants.SEGMENTS.ADMIN_STATS_COLLECTIONS, this.auth.requirePermission('system:view'),
      this.controller.getStats);
    this.get(RouteConstants.SEGMENTS.ADMIN_STATS_SECURITY, this.auth.requirePermission('system:view'), 
      this.controller.getSecurityStats);
    this.get(RouteConstants.SEGMENTS.ADMIN_STATS_HOST, this.auth.requirePermission('system:view'),
      this.controller.getHostStats);
    this.get(RouteConstants.SEGMENTS.ADMIN_STATS_SCHEDULE, this.auth.requirePermission('system:view'),
      this.controller.getScheduleOutlook);
    this.get(RouteConstants.SEGMENTS.ADMIN_STATS_ATTENTION, this.auth.requirePermission('system:view'),
      this.controller.getAttention);
    this.get(RouteConstants.SEGMENTS.ADMIN_STATS_SITES, this.auth.requirePermission('system:view'),
      this.controller.getSiteStats);
    // Guarded by the session only: these are the CALLER's own edits, and a permission for reading
    // your own recent work would be a permission to use the dashboard.
    this.get(RouteConstants.SEGMENTS.ADMIN_STATS_RECENT_EDITS, this.auth.guard(),
      this.controller.getRecentEdits);
    this.get(RouteConstants.SEGMENTS.ADMIN_STATS_INSTALLATION, this.auth.requirePermission('system:view'),
      this.controller.getInstallation);
    
    // Integration management
    this.get(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS, this.auth.requirePermission('integrations:view'), 
      this.controller.getIntegrations);
    this.get(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_TYPE, this.auth.requirePermission('integrations:view'), 
      this.controller.getIntegration);
    this.put(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_TYPE, this.auth.requirePermission('integrations:manage'), 
      this.controller.updateIntegration);
    this.patch(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROVIDER, 
      this.auth.requirePermission('integrations:manage'), 
      this.controller.setIntegrationProviderEnabled);
    this.delete(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROVIDER, 
      this.auth.requirePermission('integrations:manage'), 
      this.controller.removeIntegrationProvider);
    this.post(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROFILE_ACTIVATE, 
      this.auth.requirePermission('integrations:manage'), 
      this.controller.activateIntegrationProfile);
    this.patch(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROFILE, 
      this.auth.requirePermission('integrations:manage'), 
      this.controller.renameIntegrationProfile);
    this.delete(RouteConstants.SEGMENTS.ADMIN_INTEGRATIONS_PROFILE, 
      this.auth.requirePermission('integrations:manage'), 
      this.controller.deleteIntegrationProfile);
    
    // Telemetry and monitoring
    this.post(RouteConstants.SEGMENTS.ADMIN_TELEMETRY_EMAIL_TEST, this.auth.requirePermission('system:view'), 
      this.controller.sendTestTelemetryEmail);
    this.get(RouteConstants.SEGMENTS.ADMIN_ACTIVITY, this.auth.requirePermission('system:view'), 
      this.controller.getActivity);
    this.get(RouteConstants.SEGMENTS.ADMIN_LOGS, this.auth.requirePermission('system:logs'), 
      this.controller.getLogs);
    this.get(RouteConstants.SEGMENTS.ADMIN_AUDIT, this.auth.requirePermission('system:audit'), 
      this.controller.getAuditLogs);

    // Backup management
    // A system BACKUP is the whole database — every site on the box — and restore overwrites all of
    // them; a system UPDATE replaces the platform's own code. Both were gated on a PERMISSION alone,
    // and a site administrator's `admin` role carries `*`, so any customer's admin could take a copy
    // of every other customer's data, or roll the platform back under them. Permission answers "may
    // this operator do backups"; the guard answers "for whom", and that was the half missing.
    const platform = this.platformAdmin.middleware();
    this.get(RouteConstants.SEGMENTS.ADMIN_BACKUPS, this.auth.requirePermission('system:backup:view'), platform,
      this.backupController.listBackups);
    this.registerPlatformRoutes(platform);
  }
}