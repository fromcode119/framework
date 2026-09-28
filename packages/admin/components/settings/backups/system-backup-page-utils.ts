import { Platform } from '@fromcode119/react-class-components';
import { RestoreTargetScope } from '@/components/settings/backups/enums/restore-target-scope.enum';
import { BackupPreset } from '@/components/settings/backups/enums/backup-preset.enum';
import { BackupSectionKey, BackupCatalogGroupKey, BackupCatalogRootKind } from '@fromcode119/core';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IBackupDownloadProgressView } from '@/components/settings/backups/interfaces/backup-download-progress-view.interface';
import type { IBackupCatalogGroupView } from '@/components/settings/backups/interfaces/backup-catalog-group-view.interface';
import type { IBackupCatalogItemView } from '@/components/settings/backups/interfaces/backup-catalog-item-view.interface';
import type { IRestoreDialogState } from '@/components/settings/backups/interfaces/restore-dialog-state.interface';
import type { ISystemBackupListResponseView } from '@/components/settings/backups/interfaces/system-backup-list-response-view.interface';
import { BackupSectionOptions } from '@/components/settings/backups/backup-section-options';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class SystemBackupPageUtils {
  static createEmptyListResponse(): ISystemBackupListResponseView {
    return {
      groups: [],
      capabilities: {
        canManage: false,
        canRestore: false,
      },
    };
  }

  /**
   * Hydrate a catalog list response at the FETCH BOUNDARY.
   *
   * `IBackupCatalogGroupView.key` and `IBackupCatalogItemView.group`/`rootKind` are DECLARED as
   * reactor Enums but arrive as plain strings (`Enum.toJSON()` returns `.value`). The per-predicate
   * `resolve()` calls below already cover the comparisons, but a raw string also made
   * `group.key.value` — the React `key` for every catalog section — `undefined`. Resolving once here
   * fixes that and makes the predicates' own hydration belt-and-braces.
   */
  static hydrateGroups(groups: unknown): IBackupCatalogGroupView[] {
    if (!Array.isArray(groups)) return [];
    return groups.map((group: any) => ({
      ...group,
      key: BackupCatalogGroupKey.resolve(group?.key),
      items: (Array.isArray(group?.items) ? group.items : []).map((item: any) => ({
        ...item,
        group: BackupCatalogGroupKey.resolve(item?.group),
        rootKind: BackupCatalogRootKind.resolve(item?.rootKind),
      })),
    })) as IBackupCatalogGroupView[];
  }

  static createInitialRestoreState(): IRestoreDialogState {
    return {
      backup: null,
      targetScope: RestoreTargetScope.SYSTEM,
      targetSlug: '',
      preview: null,
      confirmationText: '',
      formError: '',
    };
  }

  static createRestoreStateForItem(item: IBackupCatalogItemView): IRestoreDialogState {
    return {
      backup: item,
      targetScope: this.getTargetScope(item),
      targetSlug: item.scopeSlug || '',
      preview: null,
      confirmationText: '',
      formError: '',
    };
  }

  /**
   * The catalog `group` / `rootKind` reach the browser as PLAIN STRINGS: they are reactor Enum
   * members server-side, and `Enum.toJSON()` serialises each to its `.value`. Comparing that string
   * to an Enum member object is always false, so every predicate below silently took its fallback
   * branch — which is why a system backup offered no Restore and no Delete action, and why the
   * System group was captioned with the site-transfer description. `resolve()` re-hydrates the
   * string into the member before any `===`.
   */
  private static groupOf(item: IBackupCatalogItemView): BackupCatalogGroupKey {
    return BackupCatalogGroupKey.resolve(item.group);
  }

  private static rootKindOf(item: IBackupCatalogItemView): BackupCatalogRootKind {
    return BackupCatalogRootKind.resolve(item.rootKind);
  }

  static getTargetScope(item: IBackupCatalogItemView): RestoreTargetScope {
    const group = this.groupOf(item);
    if (group === BackupCatalogGroupKey.PLUGINS) return RestoreTargetScope.PLUGIN;
    if (group === BackupCatalogGroupKey.THEMES) return RestoreTargetScope.THEME;
    return RestoreTargetScope.SYSTEM;
  }

  static buildTargetKind(scope: RestoreTargetScope, slug: string): string {
    if (scope === RestoreTargetScope.SYSTEM) return 'system';
    return `${scope.value}:${String(slug || '').trim()}`;
  }

  static canRestore(item: IBackupCatalogItemView): boolean {
    const group = this.groupOf(item);
    return group === BackupCatalogGroupKey.SYSTEM || group === BackupCatalogGroupKey.PLUGINS || group === BackupCatalogGroupKey.THEMES;
  }

  static canDelete(item: IBackupCatalogItemView): boolean {
    return this.rootKindOf(item) === BackupCatalogRootKind.BACKUPS;
  }

  static formatBytes(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
  }

  static formatTimestamp(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return AdminI18n.t('settings.components.unknown');
    return date.toLocaleString();
  }

  static totalBackups(groups: IBackupCatalogGroupView[]): number {
    return groups.reduce((sum, group) => sum + group.items.length, 0);
  }

  static totalBytes(groups: IBackupCatalogGroupView[]): number {
    return groups.reduce(
      (sum, group) => sum + group.items.reduce((groupTotal, item) => groupTotal + item.sizeBytes, 0),
      0,
    );
  }

  static getLatestBackup(groups: IBackupCatalogGroupView[]): IBackupCatalogItemView | null {
    const items = groups.flatMap((group) => group.items);
    if (!items.length) return null;
    return [...items].sort((left, right) => Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt))[0] || null;
  }

  static getGroupDescription(groupKey: IBackupCatalogGroupView['key']): string {
    const group = BackupCatalogGroupKey.resolve(groupKey);
    if (group === BackupCatalogGroupKey.SYSTEM) return AdminI18n.t('settings.components.frameworkSnapshotsForFullSystem');
    if (group === BackupCatalogGroupKey.PLUGINS) return AdminI18n.t('settings.components.pluginSpecificArchivesCreatedDuring');
    if (group === BackupCatalogGroupKey.THEMES) return AdminI18n.t('settings.components.themeSnapshotsCapturedBeforeOverwrite');
    if (group === BackupCatalogGroupKey.DATABASE) return AdminI18n.t('settings.components.databaseOnlyDumpsRetainedSeparately');
    return AdminI18n.t('settings.components.siteTransferBundlesAndRelated');
  }

  static getScopeLabel(item: IBackupCatalogItemView): string {
    const group = this.groupOf(item);
    if (group === BackupCatalogGroupKey.PLUGINS && item.scopeSlug) return AdminI18n.t('settings.components.plugin', { scopeSlug: item.scopeSlug });
    if (group === BackupCatalogGroupKey.THEMES && item.scopeSlug) return AdminI18n.t('settings.components.theme', { scopeSlug: item.scopeSlug });
    if (group === BackupCatalogGroupKey.DATABASE) return AdminI18n.t('settings.components.database');
    if (group === BackupCatalogGroupKey.TRANSFER) return AdminI18n.t('settings.components.siteTransfer');
    if (group === BackupCatalogGroupKey.TENANTS) return AdminI18n.t('settings.components.sites');
    return AdminI18n.t('settings.components.system');
  }

  /** Badge colour for a catalog row's scope chip, keyed off the hydrated group. */
  static getGroupBadgeVariant(item: IBackupCatalogItemView): BadgeVariant {
    const group = this.groupOf(item);
    if (group === BackupCatalogGroupKey.SYSTEM) return BadgeVariant.BLUE;
    if (group === BackupCatalogGroupKey.DATABASE) return BadgeVariant.AMBER;
    return BadgeVariant.GRAY;
  }

  static getStorageLabel(item: IBackupCatalogItemView): string {
    return this.rootKindOf(item) === BackupCatalogRootKind.SITE_TRANSFER ? 'artifacts/site-transfer' : 'backups';
  }

  static getCreateProgressLabel(percent: number): string {
    if (percent < 20) return AdminI18n.t('settings.components.validatingBackupScope');
    if (percent < 50) return AdminI18n.t('settings.components.collectingSelectedWorkspacePaths');
    if (percent < 85) return AdminI18n.t('settings.components.compressingArchiveContents');
    if (percent < 100) return AdminI18n.t('settings.components.refreshingBackupInventory');
    return AdminI18n.t('settings.components.backupArchiveReady');
  }

  static getNextCreateProgressPercent(currentPercent: number): number {
    if (currentPercent >= 84) return 84;
    return Math.min(currentPercent + 9, 84);
  }

  static getImportProgressLabel(percent: number): string {
    if (percent < 20) return AdminI18n.t('settings.components.preparingArchiveUpload');
    if (percent < 55) return AdminI18n.t('settings.components.uploadingBackupArchive');
    if (percent < 100) return AdminI18n.t('settings.components.uploadFinishedFinalizingBackupImport');
    return AdminI18n.t('settings.components.backupImportComplete');
  }

  static getImportUploadLabel(
    loadedBytes: number,
    totalBytes: number,
    percent: number,
    stalled = false,
  ): string {
    const bytesLabel = `${this.formatBytes(loadedBytes)} of ${this.formatBytes(totalBytes)}`;
    if (loadedBytes <= 0) {
      return AdminI18n.t('settings.components.preparingArchiveUpload2', { bytesLabel: bytesLabel });
    }
    if (percent >= 99) {
      return AdminI18n.t('settings.components.uploadFinishedFinalizingBackupImport2', { bytesLabel: bytesLabel });
    }
    if (stalled) {
      return AdminI18n.t('settings.components.uploadingBackupArchiveProgressUpdates', { bytesLabel: bytesLabel });
    }
    return AdminI18n.t('settings.components.uploadingBackupArchive2', { bytesLabel: bytesLabel });
  }

  static normalizeUploadPercent(loadedBytes: number, totalBytes: number | null, rawPercent: number | null): number {
    if (loadedBytes <= 0) {
      return 0;
    }
    if (typeof rawPercent === 'number' && Number.isFinite(rawPercent)) {
      return Math.min(95, Math.max(0.1, Number(rawPercent.toFixed(1))));
    }
    if (!totalBytes || totalBytes <= 0) {
      return 0.1;
    }
    return Math.min(95, Math.max(0.1, Number(((loadedBytes / totalBytes) * 100).toFixed(1))));
  }

  static formatProgressPercent(percent: number): string {
    if (!Number.isFinite(percent) || percent <= 0) {
      return '0%';
    }
    return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`;
  }

  static getDownloadProgressLabel(progress: IBackupDownloadProgressView): string {
    if (progress.percent === null) {
      return AdminI18n.t('settings.components.downloading', { formatBytes: this.formatBytes(progress.loadedBytes) });
    }
    return AdminI18n.t('settings.components.downloading2', { percent: progress.percent });
  }

  static getDownloadProgressDetail(progress: IBackupDownloadProgressView): string {
    if (progress.totalBytes === null) {
      return this.formatBytes(progress.loadedBytes);
    }
    return `${this.formatBytes(progress.loadedBytes)} of ${this.formatBytes(progress.totalBytes)}`;
  }

  static toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return AdminI18n.t('settings.components.unexpectedBackupOperationFailure');
  }

  static async downloadBackup(
    id: string,
    onProgress?: (state: { loadedBytes: number; totalBytes: number | null; percent: number | null }) => void,
  ): Promise<string> {
    if (!Platform.hasWindow) return '';
    const { blob, filename } = await AdminApi.download(AdminConstants.ENDPOINTS.SYSTEM.BACKUP_DOWNLOAD(id), undefined, onProgress);
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    return filename;
  }

}