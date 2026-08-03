import { CapabilityScope } from '@core/enums/capability-scope.enum';
import { AppPathConstants } from '@core/constants/app-path.constants';
import type { IMenuItemManifest } from '@core/interfaces/menu-item-manifest.interface';
import type { ISecondaryPanelItemManifest } from '@core/interfaces/secondary-panel-item-manifest.interface';
import type { IAdminSecondaryPanelInputItem } from '@core/plugin/services/interfaces/admin-secondary-panel-input-item.interface';

export class AdminSystemNavigationMetadataService {
  private static readonly SYSTEM_NAMESPACE = 'org.fromcode';
  private static readonly SYSTEM_PLUGIN = 'system';
  private static readonly SYSTEM_CANONICAL_KEY = 'org.fromcode:system';

  getMenuItems(): IMenuItemManifest[] {
    return [
      { label: 'Dashboard', path: AppPathConstants.ADMIN.ROOT, icon: 'Dashboard', group: 'Core', priority: 10 },
      { label: 'Users', path: AppPathConstants.ADMIN.USERS.ROOT, icon: 'Users', group: 'Platform', priority: 11 },
      { label: 'Plugins', path: AppPathConstants.ADMIN.PLUGINS.ROOT, icon: 'Package', group: 'Management', priority: 20 },
      { label: 'Media', path: AppPathConstants.ADMIN.MEDIA.ROOT, icon: 'Image', group: 'Core', priority: 30 },
      { label: 'Activity', path: AppPathConstants.ADMIN.ACTIVITY, icon: 'Activity', group: 'Platform', priority: 85 },
      { label: 'Themes', path: AppPathConstants.ADMIN.THEMES.ROOT, icon: 'Palette', group: 'Platform', priority: 90 },
      { label: 'Settings', path: AppPathConstants.ADMIN.SETTINGS.ROOT, icon: 'Settings', group: 'System', priority: 95 },
    ];
  }

  getSecondaryPanelInputs(): IAdminSecondaryPanelInputItem[] {
    return this.getSecondaryPanelItems().map((item) => ({
      sourceNamespace: AdminSystemNavigationMetadataService.SYSTEM_NAMESPACE,
      sourcePlugin: AdminSystemNavigationMetadataService.SYSTEM_PLUGIN,
      sourceCanonicalKey: AdminSystemNavigationMetadataService.SYSTEM_CANONICAL_KEY,
      item,
    }));
  }

  private getSecondaryPanelItems(): ISecondaryPanelItemManifest[] {
    return [
      ...this.getUsersSecondaryPanelItems(),
      ...this.getSettingsSecondaryPanelItems(),
    ];
  }

  private getUsersSecondaryPanelItems(): ISecondaryPanelItemManifest[] {
    return [
      {
        id: 'users-list',
        label: 'Users List',
        path: AppPathConstants.ADMIN.USERS.LIST,
        sourcePaths: [AppPathConstants.ADMIN.USERS.ROOT],
        icon: 'Users',
        scope: CapabilityScope.SELF,
        priority: 10,
        requiredRoles: ['admin'],
      },
      {
        id: 'people',
        label: 'People',
        path: AppPathConstants.ADMIN.PEOPLE.ROOT,
        sourcePaths: [AppPathConstants.ADMIN.USERS.ROOT],
        icon: 'Users',
        scope: CapabilityScope.SELF,
        priority: 15,
        requiredRoles: ['admin'],
      },
      {
        id: 'roles',
        label: 'Roles',
        path: AppPathConstants.ADMIN.USERS.ROLE_LIST,
        sourcePaths: [AppPathConstants.ADMIN.USERS.ROOT],
        icon: 'Shield',
        scope: CapabilityScope.SELF,
        priority: 20,
        requiredRoles: ['admin'],
      },
      {
        id: 'permissions',
        label: 'Permissions',
        path: AppPathConstants.ADMIN.USERS.PERMISSIONS,
        sourcePaths: [AppPathConstants.ADMIN.USERS.ROOT],
        icon: 'Lock',
        scope: CapabilityScope.SELF,
        priority: 30,
        requiredRoles: ['admin'],
      },
    ];
  }

  private getSettingsSecondaryPanelItems(): ISecondaryPanelItemManifest[] {
    return [
      {
        id: 'general',
        label: 'General',
        path: AppPathConstants.ADMIN.SETTINGS.GENERAL,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Settings',
        scope: CapabilityScope.SELF,
        priority: 100,
        requiredRoles: ['admin'],
      },
      {
        id: 'framework',
        label: 'Framework',
        path: AppPathConstants.ADMIN.SETTINGS.FRAMEWORK,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'System',
        scope: CapabilityScope.SELF,
        priority: 110,
        requiredRoles: ['admin'],
      },
      {
        id: 'integrations',
        label: 'Integrations',
        path: AppPathConstants.ADMIN.SETTINGS.INTEGRATIONS,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Orbit',
        scope: CapabilityScope.SELF,
        priority: 120,
        requiredRoles: ['admin'],
      },
      {
        id: 'localization',
        label: 'Localization',
        path: AppPathConstants.ADMIN.SETTINGS.LOCALIZATION,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Globe',
        scope: CapabilityScope.SELF,
        priority: 130,
        requiredRoles: ['admin'],
      },
      {
        id: 'appearance',
        label: 'Appearance',
        path: AppPathConstants.ADMIN.SETTINGS.APPEARANCE,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Palette',
        scope: CapabilityScope.SELF,
        priority: 135,
        requiredRoles: ['admin'],
      },
      {
        id: 'routing',
        label: 'Routing',
        path: AppPathConstants.ADMIN.SETTINGS.ROUTING,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Link',
        scope: CapabilityScope.SELF,
        priority: 140,
        requiredRoles: ['admin'],
      },
      {
        id: 'security',
        label: 'Security',
        path: AppPathConstants.ADMIN.SETTINGS.SECURITY,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Shield',
        scope: CapabilityScope.SELF,
        priority: 150,
        requiredRoles: ['admin'],
      },
      {
        id: 'infrastructure',
        label: 'Infrastructure',
        path: AppPathConstants.ADMIN.SETTINGS.INFRASTRUCTURE,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Activity',
        scope: CapabilityScope.SELF,
        priority: 160,
        requiredRoles: ['admin'],
      },
      {
        id: 'backups',
        label: 'Backups',
        path: AppPathConstants.ADMIN.SETTINGS.BACKUPS,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Database',
        scope: CapabilityScope.SELF,
        priority: 170,
        requiredRoles: ['admin'],
      },
      {
        id: 'updates',
        label: 'Updates',
        path: AppPathConstants.ADMIN.SETTINGS.UPDATES,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Refresh',
        scope: CapabilityScope.SELF,
        priority: 180,
        requiredRoles: ['admin'],
      },
    ];
  }
}