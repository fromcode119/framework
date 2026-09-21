import path from 'path';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';
import { PluginManager, ThemeManager, RouteConstants, SystemRedirectService } from '@fromcode119/core';
import { BaseRouter } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import multer from 'multer';

/**
 * The routes that administer the PLATFORM rather than a site: backups, redirects, and the rest of
 * the deployment-level surface.
 *
 * Separated because the guard on them is different in kind. These require both a permission AND the
 * platform scope — an operator standing inside one site must not reach them even holding the
 * permission, because "restore a backup" and "add a redirect" are answers about the whole box, not
 * about the site they are in.
 *
 * The base of `SystemRouter`, whose `registerRoutes` was a single 254-line method.
 */
export abstract class SystemPlatformRoutes extends BaseRouter {
  /** Declared here so this half can register; `SystemRouter` constructs them all. */
  protected declare auth: AuthManager;
  protected declare controller: any;
  protected declare backupController: any;
  protected declare redirectsController: any;
  protected declare emailPreferencesController: any;
  protected declare emailPreferencesTokenController: any;
  protected declare upload: multer.Multer;
  protected declare chunkUpload: multer.Multer;

  /** Called by `SystemRouter.registerRoutes()` after it has registered the site-level routes. */
  protected registerPlatformRoutes(platform: any): void {
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_CREATE_SYSTEM, this.auth.requirePermission('system:backup:manage'), platform,
      this.backupController.createSystemBackup);
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_IMPORT_SESSION, this.auth.requirePermission('system:backup:manage'), platform,
      this.backupController.startImportSession);
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_IMPORT_CHUNK, this.auth.requirePermission('system:backup:manage'), platform, this.chunkUpload.single('chunk'),
      this.backupController.uploadImportChunk);
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_IMPORT_COMPLETE, this.auth.requirePermission('system:backup:manage'), platform,
      this.backupController.completeImport);
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_IMPORT, this.auth.requirePermission('system:backup:manage'), platform, this.upload.single('backup'),
      this.backupController.importBackup);
    this.get(RouteConstants.SEGMENTS.ADMIN_BACKUPS_ID_DOWNLOAD, this.auth.requirePermission('system:backup:view'), platform,
      this.backupController.downloadBackup);
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_ID_RESTORE_PREVIEW, this.auth.requirePermission('system:backup:restore'), platform,
      this.backupController.previewRestore);
    this.post(RouteConstants.SEGMENTS.ADMIN_BACKUPS_ID_RESTORE_EXECUTE, this.auth.requirePermission('system:backup:restore'), platform,
      this.backupController.executeRestore);
    this.delete(RouteConstants.SEGMENTS.ADMIN_BACKUPS_ID, this.auth.requirePermission('system:backup:manage'), platform,
      this.backupController.deleteBackup);
    
    // URL redirect rules (framework-owned store — Settings → Redirects)
    this.get(RouteConstants.SEGMENTS.ADMIN_REDIRECTS, this.auth.requirePermission('system:manage'),
      (req: any, res: any) => this.redirectsController.list(req, res));
    this.post(RouteConstants.SEGMENTS.ADMIN_REDIRECTS, this.auth.requirePermission('system:manage'),
      (req: any, res: any) => this.redirectsController.create(req, res));
    this.patch(RouteConstants.SEGMENTS.ADMIN_REDIRECTS_ID, this.auth.requirePermission('system:manage'),
      (req: any, res: any) => this.redirectsController.update(req, res));
    this.delete(RouteConstants.SEGMENTS.ADMIN_REDIRECTS_ID, this.auth.requirePermission('system:manage'),
      (req: any, res: any) => this.redirectsController.remove(req, res));

    // System settings
    this.get(RouteConstants.SEGMENTS.ADMIN_SETTINGS, this.auth.requirePermission('system:manage'),
      this.controller.getSettings);
    this.get(RouteConstants.SEGMENTS.ADMIN_SETTINGS_PLATFORM_KEYS, this.auth.requirePermission('system:manage'),
      this.controller.platformSettingKeys);
    this.post(RouteConstants.SEGMENTS.ADMIN_SETTINGS, this.auth.requirePermission('system:manage'), 
      this.controller.updateSettings);
    this.put(RouteConstants.SEGMENTS.ADMIN_SETTINGS, this.auth.requirePermission('system:manage'), 
      this.controller.updateSettings);
    
    // What an erasure would actually do to each dataset on this site, and who decided it. Read-only:
    // the values themselves are written through the settings PUT above, like every other system setting.
    this.get(RouteConstants.SEGMENTS.ADMIN_PERSONAL_DATA_POLICY, this.auth.requirePermission('system:manage'),
      this.controller.getPersonalDataPolicy);

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
    // Deliberately NOT behind PlatformAdminGuard: that guard passes every admin on a single-tenant
    // install, and this must be exact in both modes. PlatformOwnershipService re-checks inside the
    // transaction that the caller still holds the seat, which is the real authority.
    this.post(RouteConstants.SEGMENTS.ADMIN_USERS_OWNERSHIP, this.auth.requirePermission('users:manage'),
      this.controller.transferOwnership);

    // "What relates to this record?" — subject-keyed, so it sits beside the people routes rather than
    // under them. Same `users:view` permission: it reads records the viewer can already open.
    this.get(RouteConstants.SEGMENTS.ADMIN_RECORD_LINKS, this.auth.requirePermission('users:view'),
      this.controller.getRecordLinks);

    // People management (unified identity model): list people, promote a person to a login account.
    this.get(RouteConstants.SEGMENTS.ADMIN_PEOPLE, this.auth.requirePermission('users:view'),
      this.controller.getPeople);
    // Static `/records` must be registered before `/:id` so it is not captured as an id.
    this.get(RouteConstants.SEGMENTS.ADMIN_PEOPLE_RECORDS, this.auth.requirePermission('users:view'),
      this.controller.getRecordsByRef);
    // Literal path first: `/admin/people/:id` matches any single segment and would resolve "suggest"
    // as a person id.
    this.get(RouteConstants.SEGMENTS.ADMIN_PEOPLE_SUGGEST, this.auth.requirePermission('users:view'),
      this.controller.suggestRecipients);
    this.get(RouteConstants.SEGMENTS.ADMIN_PEOPLE_ID, this.auth.requirePermission('users:view'),
      this.controller.getPerson);
    this.get(RouteConstants.SEGMENTS.ADMIN_PEOPLE_ID_RECORDS, this.auth.requirePermission('users:view'),
      this.controller.getPersonRecords);
    this.patch(RouteConstants.SEGMENTS.ADMIN_PEOPLE_ID, this.auth.requirePermission('users:manage'),
      this.controller.savePerson);
    this.post(RouteConstants.SEGMENTS.ADMIN_PEOPLE_ID_CREATE_USER, this.auth.requirePermission('users:manage'),
      this.controller.createUserFromPerson);
    this.post(RouteConstants.SEGMENTS.ADMIN_PEOPLE_ID_LINK_USER, this.auth.requirePermission('users:manage'),
      this.controller.linkUser);
    this.delete(RouteConstants.SEGMENTS.ADMIN_PEOPLE_ID, this.auth.requirePermission('users:manage'),
      this.controller.deletePerson);

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
    this.get(RouteConstants.SEGMENTS.UPDATE_CHECK, this.auth.requirePermission('system:update'), platform, 
      this.controller.checkUpdate);
    this.post(RouteConstants.SEGMENTS.UPDATE_APPLY, this.auth.requirePermission('system:update'), platform,
      this.controller.applyUpdate);

    // Operator-triggered restarts. Same permission as the `deploy.restart` MCP tool — one authority
    // for "may cause downtime on this install", whether it is asked for from the admin or over MCP.
    this.get(RouteConstants.SEGMENTS.DEPLOY_APPS, this.auth.requirePermission('system:deploy:restart'),
      this.controller.listDeployApps);
    this.post(RouteConstants.SEGMENTS.DEPLOY_RESTART, this.auth.requirePermission('system:deploy:restart'),
      this.controller.restartApp);

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
