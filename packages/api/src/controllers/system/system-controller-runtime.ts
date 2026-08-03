import { AuthManager } from '@fromcode119/auth';
import { PluginManager, ThemeManager } from '@fromcode119/core';
import { IDatabaseManager } from '@fromcode119/database';
import { PublicFrontendSettingsService } from '@api/services/public-frontend-settings-service';
import { ResolutionService } from '@api/services/resolution-service';
import { ShortcodeService } from '@api/services/shortcode-service';
import { SystemService } from '@api/services/system-service';
import { UserManagementService } from '@api/services/user-management-service';
import { PeopleManagementService } from '@api/services/people-management-service';
import { AdminSearchService } from '@api/services/admin-search-service';
import { NotificationInboxService } from '@api/services/notification-inbox-service';
import { UserPreferencesService } from '@api/services/user-preferences-service';
import { RESTController } from '@api/controllers/rest/rest-controller';
import { SystemTwoFactorService } from '@api/controllers/system/system-2fa-service';

export class SystemControllerRuntime {
  readonly db: IDatabaseManager;
  readonly shortcodes: ShortcodeService;
  readonly system: SystemService;
  readonly users: UserManagementService;
  readonly people: PeopleManagementService;
  readonly search: AdminSearchService;
  readonly inbox: NotificationInboxService;
  readonly preferences: UserPreferencesService;
  readonly resolution: ResolutionService;
  readonly twoFactor: SystemTwoFactorService;
  readonly publicFrontendSettings: PublicFrontendSettingsService;

  constructor(
    readonly manager: PluginManager,
    readonly themeManager: ThemeManager,
    readonly restController: RESTController,
    auth: AuthManager
  ) {
    const dbWrapper = (manager as any).db;
    this.db = dbWrapper;
    this.shortcodes = new ShortcodeService(manager, restController);
    this.system = new SystemService(dbWrapper);
    this.users = new UserManagementService(dbWrapper, auth, manager);
    this.people = new PeopleManagementService(dbWrapper, this.users);
    this.search = new AdminSearchService(manager, dbWrapper);
    this.inbox = new NotificationInboxService(dbWrapper);
    this.preferences = new UserPreferencesService(dbWrapper);
    this.resolution = new ResolutionService(manager, themeManager, restController);
    this.twoFactor = new SystemTwoFactorService(dbWrapper, () => manager.email, this.users);
    this.publicFrontendSettings = new PublicFrontendSettingsService();

    this.manager.hooks.on('system:shortcodes:render', async (payload: any) => {
      const content = String(payload?.content ?? '');
      return this.shortcodes.render(content, {
        user: payload?.user,
        maxShortcodes: payload?.maxShortcodes,
      });
    });
  }

  buildDefaultSecondaryPanel(): Record<string, any> {
    return {
      version: 1,
      contexts: {},
      itemsByContext: {},
      globalItems: [],
      policy: {
        allowlistKey: 'admin.secondaryPanel.allowlist.v1',
        allowlistEntries: 0,
        evaluatedAt: new Date().toISOString(),
      },
      precedence: {
        scopeOrder: ['self', 'plugin-target', 'global'],
        tieBreakOrder: ['priority-asc', 'canonicalId-asc'],
      },
    };
  }
}