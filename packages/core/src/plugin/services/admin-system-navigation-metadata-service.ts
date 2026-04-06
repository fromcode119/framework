import { AppPathConstants } from '../../app-path-constants';
import type { MenuItemManifest, SecondaryPanelItemManifest } from '../../types';
import type { AdminSecondaryPanelInputItem } from './admin-secondary-panel.interfaces';

export class AdminSystemNavigationMetadataService {
  private static readonly SYSTEM_NAMESPACE = 'org.fromcode';
  private static readonly SYSTEM_PLUGIN = 'system';
  private static readonly SYSTEM_CANONICAL_KEY = 'org.fromcode:system';

  getMenuItems(): MenuItemManifest[] {
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

  getSecondaryPanelInputs(): AdminSecondaryPanelInputItem[] {
    return this.getSecondaryPanelItems().map((item) => ({
      sourceNamespace: AdminSystemNavigationMetadataService.SYSTEM_NAMESPACE,
      sourcePlugin: AdminSystemNavigationMetadataService.SYSTEM_PLUGIN,
      sourceCanonicalKey: AdminSystemNavigationMetadataService.SYSTEM_CANONICAL_KEY,
      item,
    }));
  }

  private getSecondaryPanelItems(): SecondaryPanelItemManifest[] {
    return [
      ...this.getUsersSecondaryPanelItems(),
      ...this.getSettingsSecondaryPanelItems(),
    ];
  }

  private getUsersSecondaryPanelItems(): SecondaryPanelItemManifest[] {
    return [
      {
        id: 'users-list',
        label: 'Users List',
        path: AppPathConstants.ADMIN.USERS.LIST,
        sourcePaths: [AppPathConstants.ADMIN.USERS.ROOT],
        icon: 'Users',
        scope: 'self',
        priority: 10,
        requiredRoles: ['admin'],
      },
      {
        id: 'roles',
        label: 'Roles',
        path: AppPathConstants.ADMIN.USERS.ROLE_LIST,
        sourcePaths: [AppPathConstants.ADMIN.USERS.ROOT],
        icon: 'Shield',
        scope: 'self',
        priority: 20,
        requiredRoles: ['admin'],
      },
      {
        id: 'permissions',
        label: 'Permissions',
        path: AppPathConstants.ADMIN.USERS.PERMISSIONS,
        sourcePaths: [AppPathConstants.ADMIN.USERS.ROOT],
        icon: 'Lock',
        scope: 'self',
        priority: 30,
        requiredRoles: ['admin'],
      },
    ];
  }

  private getSettingsSecondaryPanelItems(): SecondaryPanelItemManifest[] {
    return [
      {
        id: 'general',
        label: 'General',
        path: AppPathConstants.ADMIN.SETTINGS.GENERAL,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Settings',
        scope: 'self',
        priority: 100,
        requiredRoles: ['admin'],
      },
      {
        id: 'framework',
        label: 'Framework',
        path: AppPathConstants.ADMIN.SETTINGS.FRAMEWORK,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'System',
        scope: 'self',
        priority: 110,
        requiredRoles: ['admin'],
      },
      {
        id: 'integrations',
        label: 'Integrations',
        path: AppPathConstants.ADMIN.SETTINGS.INTEGRATIONS,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Orbit',
        scope: 'self',
        priority: 120,
        requiredRoles: ['admin'],
      },
      {
        id: 'localization',
        label: 'Localization',
        path: AppPathConstants.ADMIN.SETTINGS.LOCALIZATION,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Globe',
        scope: 'self',
        priority: 130,
        requiredRoles: ['admin'],
      },
      {
        id: 'routing',
        label: 'Routing',
        path: AppPathConstants.ADMIN.SETTINGS.ROUTING,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Link',
        scope: 'self',
        priority: 140,
        requiredRoles: ['admin'],
      },
      {
        id: 'security',
        label: 'Security',
        path: AppPathConstants.ADMIN.SETTINGS.SECURITY,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Shield',
        scope: 'self',
        priority: 150,
        requiredRoles: ['admin'],
      },
      {
        id: 'infrastructure',
        label: 'Infrastructure',
        path: AppPathConstants.ADMIN.SETTINGS.INFRASTRUCTURE,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Activity',
        scope: 'self',
        priority: 160,
        requiredRoles: ['admin'],
      },
      {
        id: 'updates',
        label: 'Updates',
        path: AppPathConstants.ADMIN.SETTINGS.UPDATES,
        sourcePaths: [AppPathConstants.ADMIN.SETTINGS.ROOT],
        icon: 'Refresh',
        scope: 'self',
        priority: 170,
        requiredRoles: ['admin'],
      },
    ];
  }
}