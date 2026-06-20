import { BaseRouter } from '../routers/base-router';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AuthManager } from '@fromcode119/auth';
import { PluginManager, ThemeManager, RouteConstants } from '@fromcode119/core';
import { RESTController } from '../controllers/rest/rest-controller';
import { SystemController } from '../controllers/system/system-controller';
import { SystemBackupController } from '../controllers/system/system-backup-controller';
import { SystemBackupRepository } from '../repositories/system-backup-repository';
import { SystemBackupService } from '../services/system-backup-service';

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
  private backupController: SystemBackupController;
  private auth: AuthManager;
  private upload: multer.Multer;
  private chunkUpload: multer.Multer;

  constructor(
    manager: PluginManager,
    themeManager: ThemeManager,
    auth: AuthManager,
    restController: RESTController
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
  }

  protected registerRoutes(): void {
    // Admin metadata and stats
    this.get(RouteConstants.SEGMENTS.ADMIN_METADATA, this.auth.requirePermission('system:view'), 
      this.controller.getAdminMetadata);
    this.get(RouteConstants.SEGMENTS.ADMIN_STATS_COLLECTIONS, this.auth.requirePermission('system:view'), 
      this.controller.getStats);
    this.get(RouteConstants.SEGMENTS.ADMIN_STATS_SECURITY, this.auth.requirePermission('system:view'), 
      this.controller.getSecurityStats);
    
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
    this.get(RouteConstants.SEGMENTS.ADMIN_BACKUPS, this.auth.requirePermission('system:backup:view'),
      this.backupController.listBackups);
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_CREATE_SYSTEM, this.auth.requirePermission('system:backup:manage'),
      this.backupController.createSystemBackup);
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_IMPORT_SESSION, this.auth.requirePermission('system:backup:manage'),
      this.backupController.startImportSession);
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_IMPORT_CHUNK, this.auth.requirePermission('system:backup:manage'), this.chunkUpload.single('chunk'),
      this.backupController.uploadImportChunk);
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_IMPORT_COMPLETE, this.auth.requirePermission('system:backup:manage'),
      this.backupController.completeImport);
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_IMPORT, this.auth.requirePermission('system:backup:manage'), this.upload.single('backup'),
      this.backupController.importBackup);
    this.get(RouteConstants.SEGMENTS.ADMIN_BACKUPS_ID_DOWNLOAD, this.auth.requirePermission('system:backup:view'),
      this.backupController.downloadBackup);
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_ID_RESTORE_PREVIEW, this.auth.requirePermission('system:backup:restore'),
      this.backupController.previewRestore);
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_ID_RESTORE_EXECUTE, this.auth.requirePermission('system:backup:restore'),
      this.backupController.executeRestore);
    this.delete(RouteConstants.SEGMENTS.ADMIN_BACKUPS_ID, this.auth.requirePermission('system:backup:manage'),
      this.backupController.deleteBackup);
    
    // System settings
    this.get(RouteConstants.SEGMENTS.ADMIN_SETTINGS, this.auth.requirePermission('system:manage'), 
      this.controller.getSettings);
    this.post(RouteConstants.SEGMENTS.ADMIN_SETTINGS, this.auth.requirePermission('system:manage'), 
      this.controller.updateSettings);
    this.put(RouteConstants.SEGMENTS.ADMIN_SETTINGS, this.auth.requirePermission('system:manage'), 
      this.controller.updateSettings);
    
    // Role management
    this.get(RouteConstants.SEGMENTS.ADMIN_ROLES, this.auth.requirePermission('roles:view'), 
      this.controller.getRoles);
    this.post(RouteConstants.SEGMENTS.ADMIN_ROLES, this.auth.requirePermission('roles:manage'), 
      this.controller.saveRole);
    this.get(RouteConstants.SEGMENTS.ADMIN_ROLES_SLUG, this.auth.requirePermission('roles:view'), 
      this.controller.getRole);
    this.put(RouteConstants.SEGMENTS.ADMIN_ROLES_SLUG, this.auth.requirePermission('roles:manage'), 
      this.controller.saveRole);
    this.delete(RouteConstants.SEGMENTS.ADMIN_ROLES_SLUG, this.auth.requirePermission('roles:manage'), 
      this.controller.deleteRole);
    this.get(RouteConstants.SEGMENTS.ADMIN_PERMISSIONS, this.auth.requirePermission('roles:view'), 
      this.controller.getPermissions);
    this.post(RouteConstants.SEGMENTS.ADMIN_PERMISSIONS, this.auth.requirePermission('roles:manage'), 
      this.controller.savePermission);
    
    // User management
    this.get(RouteConstants.SEGMENTS.ADMIN_USERS, this.auth.requirePermission('users:view'), 
      this.controller.getUsers);
    this.post(RouteConstants.SEGMENTS.ADMIN_USERS, this.auth.requirePermission('users:manage'), 
      this.controller.saveUser);
    this.get(RouteConstants.SEGMENTS.ADMIN_USERS_ID, this.auth.requirePermission('users:view'), 
      this.controller.getUser);
    this.put(RouteConstants.SEGMENTS.ADMIN_USERS_ID, this.auth.requirePermission('users:manage'), 
      this.controller.saveUser);
    this.delete(RouteConstants.SEGMENTS.ADMIN_USERS_ID, this.auth.requirePermission('users:manage'), 
      this.controller.deleteUser);
    this.post(RouteConstants.SEGMENTS.ADMIN_USERS_ROLES, this.auth.requirePermission('users:manage'),
      this.controller.saveUserRoles);

    // People management (unified identity model): list people, promote a person to a login account.
    this.get(RouteConstants.SEGMENTS.ADMIN_PEOPLE, this.auth.requirePermission('users:view'),
      this.controller.getPeople);
    // Static `/records` must be registered before `/:id` so it is not captured as an id.
    this.get(RouteConstants.SEGMENTS.ADMIN_PEOPLE_RECORDS, this.auth.requirePermission('users:view'),
      this.controller.getRecordsByRef);
    this.get(RouteConstants.SEGMENTS.ADMIN_PEOPLE_ID, this.auth.requirePermission('users:view'),
      this.controller.getPerson);
    this.get(RouteConstants.SEGMENTS.ADMIN_PEOPLE_ID_RECORDS, this.auth.requirePermission('users:view'),
      this.controller.getPersonRecords);
    this.patch(RouteConstants.SEGMENTS.ADMIN_PEOPLE_ID, this.auth.requirePermission('users:manage'),
      this.controller.savePerson);
    this.post(RouteConstants.SEGMENTS.ADMIN_PEOPLE_ID_CREATE_USER, this.auth.requirePermission('users:manage'),
      this.controller.createUserFromPerson);

    // 2FA Management
    this.get(RouteConstants.SEGMENTS.ADMIN_USERS_2FA_STATUS, this.auth.requirePermission('users:view'), 
      this.controller.getTwoFactorStatus);
    this.post(RouteConstants.SEGMENTS.ADMIN_USERS_2FA_SETUP, this.auth.requirePermission('users:manage'), 
      this.controller.setup2FA);
    this.post(RouteConstants.SEGMENTS.ADMIN_USERS_2FA_VERIFY, this.auth.requirePermission('users:manage'), 
      this.controller.verify2FA);
    this.post(RouteConstants.SEGMENTS.ADMIN_USERS_2FA_RECOVERY, 
      this.auth.requirePermission('users:manage'), 
      this.controller.regenerateRecoveryCodes);
    this.delete(RouteConstants.SEGMENTS.ADMIN_USERS_2FA_DISABLE, this.auth.requirePermission('users:manage'), 
      this.controller.disable2FA);
    
    // System updates
    this.get(RouteConstants.SEGMENTS.UPDATE_CHECK, this.auth.requirePermission('system:update'), 
      this.controller.checkUpdate);
    this.post(RouteConstants.SEGMENTS.UPDATE_APPLY, this.auth.requirePermission('system:update'), 
      this.controller.applyUpdate);
    
    // Public/frontend endpoints
    this.get(RouteConstants.SEGMENTS.EVENTS, this.auth.guard(), this.controller.getEvents);
    this.get(RouteConstants.SEGMENTS.FRONTEND, this.controller.getFrontendMetadata);
    this.get(RouteConstants.SEGMENTS.I18N, this.controller.getI18n);
    
    // Content features
    this.get(RouteConstants.SEGMENTS.SHORTCODES, this.auth.requirePermission('content:read'), 
      this.controller.getShortcodes);
    this.get(RouteConstants.SEGMENTS.DATA_SOURCES, this.auth.requirePermission('content:read'), 
      this.controller.getDataSources);
    this.get(RouteConstants.SEGMENTS.DATA_SOURCE_QUERY, this.auth.requirePermission('content:read'), 
      this.controller.queryDataSource);
    this.post(RouteConstants.SEGMENTS.DATA_SOURCE_QUERY, this.auth.requirePermission('content:read'), 
      this.controller.queryDataSource);
    this.post(RouteConstants.SEGMENTS.SHORTCODES_RENDER, this.auth.requirePermission('content:read'), 
      this.controller.renderShortcodes);
    this.get(RouteConstants.SEGMENTS.RESOLVE, this.controller.resolveSlug);
  }
}