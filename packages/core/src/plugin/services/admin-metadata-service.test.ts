import { describe, expect, it } from 'vitest';
import { AppPathConstants } from '../../app-path-constants';
import type { LoadedPlugin } from '../../types';
import { AdminMetadataService } from './admin-metadata-service';

describe('AdminMetadataService', () => {
  const service = new AdminMetadataService();

  it('emits system-owned users and settings secondary items with deterministic order and source paths', () => {
    const result = service.getAdminMetadata([], new Map(), {}, []);
    const systemItems = result.secondaryPanel.itemsByContext['org.fromcode:system'] || [];
    const userItems = systemItems.filter((item) => item.sourcePaths.includes(AppPathConstants.ADMIN.USERS.ROOT));
    const settingsItems = systemItems.filter((item) => item.sourcePaths.includes(AppPathConstants.ADMIN.SETTINGS.ROOT));

    expect(result.secondaryPanel.contexts['org.fromcode:system']).toBeDefined();
    expect(userItems.map((item) => item.id)).toEqual(['users-list', 'roles', 'permissions']);
    expect(userItems.map((item) => item.label)).toEqual(['Users List', 'Roles', 'Permissions']);
    expect(userItems.every((item) => item.sourcePaths.every((path) => path === AppPathConstants.ADMIN.USERS.ROOT))).toBe(true);
    expect(settingsItems.map((item) => item.id)).toEqual([
      'general',
      'framework',
      'integrations',
      'localization',
      'routing',
      'security',
      'infrastructure',
      'updates',
    ]);
    expect(settingsItems.map((item) => item.label)).toEqual([
      'General',
      'Framework',
      'Integrations',
      'Localization',
      'Routing',
      'Security',
      'Infrastructure',
      'Updates',
    ]);
    expect(settingsItems.every((item) => item.sourcePaths.every((path) => path === AppPathConstants.ADMIN.SETTINGS.ROOT))).toBe(true);
  });

  it('keeps plugin secondary items while adding system-owned metadata and emits a single settings primary item', () => {
    const analyticsPlugin = {
      instanceId: 'analytics-1',
      state: 'active',
      manifest: {
        slug: 'analytics',
        namespace: 'org.fromcode',
        name: 'Analytics',
        version: '1.0.0',
        category: 'analytics',
        admin: {
          secondaryPanel: {
            items: [
              {
                id: 'overview',
                label: 'Overview',
                path: '/plugins/analytics/overview',
                sourcePaths: ['/plugins/analytics'],
                scope: 'self',
                priority: 10,
              },
            ],
          },
        },
      },
    } as LoadedPlugin;

    const result = service.getAdminMetadata([analyticsPlugin], new Map(), {}, []);
    const analyticsItems = result.secondaryPanel.itemsByContext['org.fromcode:analytics'] || [];
    const settingsItems = result.menu.filter((item: any) => item.path === AppPathConstants.ADMIN.SETTINGS.ROOT);
    const usersItem = result.menu.find((item: any) => item.path === AppPathConstants.ADMIN.USERS.ROOT);

    expect(analyticsItems.map((item) => item.id)).toEqual(['overview']);
    expect(analyticsItems[0]?.sourcePaths).toEqual(['/plugins/analytics']);
    expect(settingsItems).toHaveLength(1);
    expect(settingsItems[0]?.label).toBe('Settings');
    expect(usersItem?.children).toBeUndefined();
  });
});