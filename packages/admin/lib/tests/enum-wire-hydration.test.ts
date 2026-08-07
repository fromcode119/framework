import { BackupCatalogGroupKey, BackupCatalogRootKind } from '@fromcode119/core';
import { PluginState, PluginRegistryHealth, ThemeState } from '@fromcode119/core/client';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { DependencyIssueType } from '@/components/ui/enums/dependency-issue-type.enum';
import { SystemBackupPageUtils } from '@/components/settings/backups/system-backup-page-utils';

const get = vi.fn();

vi.mock('@/lib/api', () => ({
  AdminApi: {
    get: (...args: unknown[]) => get(...args),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

/**
 * A reactor `Enum` serialises through `toJSON()` to its plain `.value`, so every enum-typed field on
 * an API payload arrives as a STRING while its interface declares the Enum. `tsc` sees Enum-vs-Enum
 * and says nothing; at runtime `member === 'rawString'` is permanently false and `rawString.value` is
 * `undefined`. That single mistake has now shipped four separate user-visible bugs in this repo
 * (password-box textarea, address-field crash, unreachable Backups Restore/Delete, and the ones
 * below). These tests pin the FETCH-BOUNDARY hydration that prevents it.
 */
describe('enum wire hydration', () => {
  beforeEach(() => {
    get.mockReset();
  });

  describe('SystemBackupPageUtils.hydrateGroups', () => {
    it('turns wire strings into members for the group key and every item', () => {
      const [group] = SystemBackupPageUtils.hydrateGroups([
        {
          key: 'plugins',
          label: 'Plugins',
          items: [{ id: 'a', group: 'plugins', rootKind: 'backups' }],
        },
      ]);

      expect(group.key).toBe(BackupCatalogGroupKey.PLUGINS);
      expect(group.items[0].group).toBe(BackupCatalogGroupKey.PLUGINS);
      expect(group.items[0].rootKind).toBe(BackupCatalogRootKind.BACKUPS);
    });

    it('gives every group a defined React key — a raw string made `group.key.value` undefined', () => {
      const groups = SystemBackupPageUtils.hydrateGroups([
        { key: 'system', label: 'System', items: [] },
        { key: 'themes', label: 'Themes', items: [] },
      ]);

      expect(groups.map((group) => group.key.value)).toEqual(['system', 'themes']);
    });

    it('makes the restore and delete predicates reachable for a wire-string system backup', () => {
      const [group] = SystemBackupPageUtils.hydrateGroups([
        { key: 'system', label: 'System', items: [{ id: 'x', group: 'system', rootKind: 'backups' }] },
      ]);

      expect(SystemBackupPageUtils.canRestore(group.items[0])).toBe(true);
      expect(SystemBackupPageUtils.canDelete(group.items[0])).toBe(true);
    });

    it('returns an empty list for a non-array payload rather than throwing', () => {
      expect(SystemBackupPageUtils.hydrateGroups(undefined)).toEqual([]);
      expect(SystemBackupPageUtils.hydrateGroups(null)).toEqual([]);
    });
  });

  describe('DependencyIssueType.resolve', () => {
    it('resolves the wire strings the 409 activation body carries', () => {
      expect(DependencyIssueType.resolve('missing')).toBe(DependencyIssueType.MISSING);
      expect(DependencyIssueType.resolve('inactive')).toBe(DependencyIssueType.INACTIVE);
      expect(DependencyIssueType.resolve('incompatible')).toBe(DependencyIssueType.INCOMPATIBLE);
    });

    it('always yields a member with a readable `.value` — DependencyDialog calls .toUpperCase() on it', () => {
      // The dialog rendered `issue.type.value.toUpperCase()`. On a raw string `.value` is undefined
      // and `.toUpperCase()` THREW, taking the whole dependency dialog down for every issue that was
      // not "missing".
      expect(() => DependencyIssueType.resolve('inactive').value.toUpperCase()).not.toThrow();
      expect(DependencyIssueType.resolve(undefined).value.toUpperCase()).toBe('INCOMPATIBLE');
    });

    it('passes an existing member straight through', () => {
      expect(DependencyIssueType.resolve(DependencyIssueType.MISSING)).toBe(DependencyIssueType.MISSING);
    });
  });

  describe('PluginVersionWaitService.fetchInstalledPlugin', () => {
    it('hydrates state/healthStatus so `plugin.state === PluginState.ACTIVE` is a real comparison', async () => {
      const { PluginVersionWaitService } = await import('@/lib/plugin-version-wait-service');
      get.mockResolvedValue([
        { manifest: { slug: 'demo', version: '1.0.0' }, state: 'active', healthStatus: 'ok' },
      ]);

      const plugin = await PluginVersionWaitService.fetchInstalledPlugin('demo');

      expect(plugin?.state).toBe(PluginState.ACTIVE);
      expect(plugin?.healthStatus).toBe(PluginRegistryHealth.resolve('ok'));
    });

    it('returns null when the slug is not installed', async () => {
      const { PluginVersionWaitService } = await import('@/lib/plugin-version-wait-service');
      get.mockResolvedValue([{ manifest: { slug: 'other', version: '1.0.0' }, state: 'active' }]);

      expect(await PluginVersionWaitService.fetchInstalledPlugin('demo')).toBeNull();
    });
  });

  describe('InstalledThemesPageController.fetchThemes', () => {
    it('hydrates `state`, so the active theme is not rendered as inactive', async () => {
      const { InstalledThemesPageController } = await import('@/app/themes/installed/installed-themes-page-controller');
      get.mockResolvedValue([
        { slug: 'aurora', name: 'Aurora', state: 'active' },
        { slug: 'basic', name: 'Basic', state: 'inactive' },
      ]);

      const result = await InstalledThemesPageController.fetchThemes();

      expect(result.themes[0].state).toBe(ThemeState.ACTIVE);
      expect(result.themes[1].state).toBe(ThemeState.INACTIVE);
      expect(result.themes.filter((theme) => theme.state === ThemeState.ACTIVE)).toHaveLength(1);
    });
  });
});
