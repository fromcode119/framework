import { RestoreTargetScope } from '@/components/settings/backups/enums/restore-target-scope.enum';
import { BackupPreset } from '@/components/settings/backups/enums/backup-preset.enum';
import { BackupSectionKey, BackupCatalogGroupKey, BackupCatalogRootKind } from '@fromcode119/core';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IBackupDownloadProgressView } from '@/components/settings/backups/interfaces/backup-download-progress-view.interface';
import type { IBackupCatalogGroupView } from '@/components/settings/backups/interfaces/backup-catalog-group-view.interface';
import type { IBackupCatalogItemView } from '@/components/settings/backups/interfaces/backup-catalog-item-view.interface';
import type { IRestoreDialogState } from '@/components/settings/backups/interfaces/restore-dialog-state.interface';
import type { ISystemBackupListResponseView } from '@/components/settings/backups/interfaces/system-backup-list-response-view.interface';
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

  static createDefaultSections(): BackupSectionKey[] {
    return BackupSectionKey.values() as BackupSectionKey[];
  }

  static applyCreatePreset(value: BackupPreset): BackupSectionKey[] {
    if (value === BackupPreset.CORE_DB) return [BackupSectionKey.CORE, BackupSectionKey.DATABASE];
    if (value === BackupPreset.PLUGINS_ONLY) return [BackupSectionKey.PLUGINS];
    if (value === BackupPreset.THEMES_ONLY) return [BackupSectionKey.THEMES];
    return this.createDefaultSections();
  }

  static toggleSection(
    sections: BackupSectionKey[],
    value: BackupSectionKey,
  ): BackupSectionKey[] {
    return sections.includes(value)
      ? sections.filter((section) => section !== value)
      : [...sections, value].sort((left, right) => this.getSectionSortIndex(left) - this.getSectionSortIndex(right));
  }

  static getSectionOptions(): Array<{
    key: BackupSectionKey;
    label: string;
    description: string;
    helper: string;
  }> {
    return [
      {
        key: BackupSectionKey.CORE,
        label: 'Core Files',
        description: 'Packages, configs, scripts, docs, tests, and the rest of the framework workspace.',
        helper: 'Use this for code and system configuration rollback.',
      },
      {
        key: BackupSectionKey.DATABASE,
        label: 'Database',
        description: 'A PostgreSQL dump or SQLite copy when the active environment supports it.',
        helper: 'Use this when you need content and settings state.',
      },
      {
        key: BackupSectionKey.PLUGINS,
        label: 'Plugins',
        description: 'The full plugins directory, including installed plugin code and assets.',
        helper: 'Use this when plugin code changed or needs migration.',
      },
      {
        key: BackupSectionKey.THEMES,
        label: 'Themes',
        description: 'The full themes directory, including custom theme source and built assets.',
        helper: 'Use this when frontend presentation changed.',
      },
    ];
  }

  static describeSections(sections: BackupSectionKey[]): string {
    if (!sections.length) return 'nothing selected';
    return sections.map((section) => this.getSectionLabel(section)).join(', ');
  }

  static getSectionLabel(value: BackupSectionKey): string {
    if (value === BackupSectionKey.CORE) return 'Core Files';
    if (value === BackupSectionKey.DATABASE) return 'Database';
    if (value === BackupSectionKey.PLUGINS) return 'Plugins';
    return 'Themes';
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

  static getTargetScope(item: IBackupCatalogItemView): RestoreTargetScope {
    if (item.group === BackupCatalogGroupKey.PLUGINS) return RestoreTargetScope.PLUGIN;
    if (item.group === BackupCatalogGroupKey.THEMES) return RestoreTargetScope.THEME;
    return RestoreTargetScope.SYSTEM;
  }

  static buildTargetKind(scope: RestoreTargetScope, slug: string): string {
    if (scope === RestoreTargetScope.SYSTEM) return 'system';
    return `${scope.value}:${String(slug || '').trim()}`;
  }

  static canRestore(item: IBackupCatalogItemView): boolean {
    return item.group === BackupCatalogGroupKey.SYSTEM || item.group === BackupCatalogGroupKey.PLUGINS || item.group === BackupCatalogGroupKey.THEMES;
  }

  static canDelete(item: IBackupCatalogItemView): boolean {
    return item.rootKind === BackupCatalogRootKind.BACKUPS;
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
    if (Number.isNaN(date.getTime())) return 'Unknown';
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
    if (groupKey === BackupCatalogGroupKey.SYSTEM) return 'Framework snapshots for full-system rollback and safety checkpoints.';
    if (groupKey === BackupCatalogGroupKey.PLUGINS) return 'Plugin-specific archives created during installs, updates, or manual protection.';
    if (groupKey === BackupCatalogGroupKey.THEMES) return 'Theme snapshots captured before overwrite or restore operations.';
    if (groupKey === BackupCatalogGroupKey.DATABASE) return 'Database-only dumps retained separately from tarball snapshots.';
    return 'Site-transfer bundles and related artifacts staged for migration workflows.';
  }

  static getScopeLabel(item: IBackupCatalogItemView): string {
    if (item.group === BackupCatalogGroupKey.PLUGINS && item.scopeSlug) return `Plugin: ${item.scopeSlug}`;
    if (item.group === BackupCatalogGroupKey.THEMES && item.scopeSlug) return `Theme: ${item.scopeSlug}`;
    if (item.group === BackupCatalogGroupKey.DATABASE) return 'Database';
    if (item.group === BackupCatalogGroupKey.TRANSFER) return 'Site Transfer';
    return 'System';
  }

  static getStorageLabel(item: IBackupCatalogItemView): string {
    return item.rootKind === BackupCatalogRootKind.SITE_TRANSFER ? 'artifacts/site-transfer' : 'backups';
  }

  static getCreateProgressLabel(percent: number): string {
    if (percent < 20) return 'Validating backup scope...';
    if (percent < 50) return 'Collecting selected workspace paths...';
    if (percent < 85) return 'Compressing archive contents...';
    if (percent < 100) return 'Refreshing backup inventory...';
    return 'Backup archive ready.';
  }

  static getNextCreateProgressPercent(currentPercent: number): number {
    if (currentPercent >= 84) return 84;
    return Math.min(currentPercent + 9, 84);
  }

  static getImportProgressLabel(percent: number): string {
    if (percent < 20) return 'Preparing archive upload...';
    if (percent < 55) return 'Uploading backup archive...';
    if (percent < 100) return 'Upload finished. Finalizing backup import...';
    return 'Backup import complete.';
  }

  static getImportUploadLabel(
    loadedBytes: number,
    totalBytes: number,
    percent: number,
    stalled = false,
  ): string {
    const bytesLabel = `${this.formatBytes(loadedBytes)} of ${this.formatBytes(totalBytes)}`;
    if (loadedBytes <= 0) {
      return `Preparing archive upload... ${bytesLabel}`;
    }
    if (percent >= 99) {
      return `Upload finished. Finalizing backup import... ${bytesLabel}`;
    }
    if (stalled) {
      return `Uploading backup archive... ${bytesLabel}. Progress updates may pause for large files.`;
    }
    return `Uploading backup archive... ${bytesLabel}`;
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
      return `Downloading ${this.formatBytes(progress.loadedBytes)}...`;
    }
    return `Downloading ${progress.percent}%`;
  }

  static getDownloadProgressDetail(progress: IBackupDownloadProgressView): string {
    if (progress.totalBytes === null) {
      return this.formatBytes(progress.loadedBytes);
    }
    return `${this.formatBytes(progress.loadedBytes)} of ${this.formatBytes(progress.totalBytes)}`;
  }

  static toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return 'Unexpected backup operation failure.';
  }

  static async downloadBackup(
    id: string,
    onProgress?: (state: { loadedBytes: number; totalBytes: number | null; percent: number | null }) => void,
  ): Promise<string> {
    if (typeof window === 'undefined') return '';
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

  private static getSectionSortIndex(value: BackupSectionKey): number {
    return (BackupSectionKey.values() as BackupSectionKey[]).indexOf(value);
  }
}