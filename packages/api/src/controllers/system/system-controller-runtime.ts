import { AuthManager } from '@fromcode119/auth';
import { PluginManager, ThemeManager } from '@fromcode119/core';
import { IDatabaseManager } from '@fromcode119/database';
import { PublicFrontendSettingsService } from '../../services/public-frontend-settings-service';
import { ResolutionService } from '../../services/resolution-service';
import { ShortcodeService } from '../../services/shortcode-service';
import { SystemService } from '../../services/system-service';
import { UserManagementService } from '../../services/user-management-service';
import { RESTController } from '../rest/rest-controller';
import { SystemTwoFactorService } from './system-2fa-service';

export class SystemControllerRuntime {
  readonly db: IDatabaseManager;
  readonly shortcodes: ShortcodeService;
  readonly system: SystemService;
  readonly users: UserManagementService;
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