import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import type {
  BackupDownloadProgressView,
  BackupCatalogGroupView,
  BackupCatalogItemView,
  RestoreDialogState,
  SystemBackupListResponseView,
} from './backups-page-client.interfaces';

export class SystemBackupPageUtils {
  static createEmptyListResponse(): SystemBackupListResponseView {
    return {
      groups: [],
      capabilities: {
        canManage: false,
        canRestore: false,
      },
    };
  }

  static createInitialRestoreState(): RestoreDialogState {
    return {
      backup: null,
      targetScope: 'system',
      targetSlug: '',
      preview: null,
      confirmationText: '',
      formError: '',
    };
  }

  static createDefaultSections(): ('core' | 'database' | 'plugins' | 'themes')[] {
    return ['core', 'database', 'plugins', 'themes'];
  }

  static applyCreatePreset(value: 'full' | 'core-db' | 'plugins-only' | 'themes-only'): ('core' | 'database' | 'plugins' | 'themes')[] {
    if (value === 'core-db') return ['core', 'database'];
    if (value === 'plugins-only') return ['plugins'];
    if (value === 'themes-only') return ['themes'];
    return this.createDefaultSections();
  }

  static toggleSection(
    sections: ('core' | 'database' | 'plugins' | 'themes')[],
    value: 'core' | 'database' | 'plugins' | 'themes',
  ): ('core' | 'database' | 'plugins' | 'themes')[] {
    return sections.includes(value)
      ? sections.filter((section) => section !== value)
      : [...sections, value].sort((left, right) => this.getSectionSortIndex(left) - this.getSectionSortIndex(right));
  }

  static getSectionOptions(): Array<{
    key: 'core' | 'database' | 'plugins' | 'themes';
    label: string;
    description: string;
    helper: string;
  }> {
    return [
      {
        key: 'core',
        label: 'Core Files',
        description: 'Packages, configs, scripts, docs, tests, and the rest of the framework workspace.',
        helper: 'Use this for code and system configuration rollback.',
      },
      {
        key: 'database',
        label: 'Database',
        description: 'A PostgreSQL dump or SQLite copy when the active environment supports it.',
        helper: 'Use this when you need content and settings state.',
      },
      {
        key: 'plugins',
        label: 'Plugins',
        description: 'The full plugins directory, including installed plugin code and assets.',
        helper: 'Use this when plugin code changed or needs migration.',
      },
      {
        key: 'themes',
        label: 'Themes',
        description: 'The full themes directory, including custom theme source and built assets.',
        helper: 'Use this when frontend presentation changed.',
      },
    ];
  }

  static describeSections(sections: ('core' | 'database' | 'plugins' | 'themes')[]): string {
    if (!sections.length) return 'nothing selected';
    return sections.map((section) => this.getSectionLabel(section)).join(', ');
  }

  static getSectionLabel(value: 'core' | 'database' | 'plugins' | 'themes'): string {
    if (value === 'core') return 'Core Files';
    if (value === 'database') return 'Database';
    if (value === 'plugins') return 'Plugins';
    return 'Themes';
  }

  static createRestoreStateForItem(item: BackupCatalogItemView): RestoreDialogState {
    return {
      backup: item,
      targetScope: this.getTargetScope(item),
      targetSlug: item.scopeSlug || '',
      preview: null,
      confirmationText: '',
      formError: '',
    };
  }

  static getTargetScope(item: BackupCatalogItemView): 'system' | 'plugin' | 'theme' {
    if (item.group === 'plugins') return 'plugin';
    if (item.group === 'themes') return 'theme';
    return 'system';
  }

  static buildTargetKind(scope: 'system' | 'plugin' | 'theme', slug: string): string {
    if (scope === 'system') return 'system';
    return `${scope}:${String(slug || '').trim()}`;
  }

  static canRestore(item: BackupCatalogItemView): boolean {
    return item.group === 'system' || item.group === 'plugins' || item.group === 'themes';
  }

  static canDelete(item: BackupCatalogItemView): boolean {
    return item.rootKind === 'backups';
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

  static totalBackups(groups: BackupCatalogGroupView[]): number {
    return groups.reduce((sum, group) => sum + group.items.length, 0);
  }

  static totalBytes(groups: BackupCatalogGroupView[]): number {
    return groups.reduce(
      (sum, group) => sum + group.items.reduce((groupTotal, item) => groupTotal + item.sizeBytes, 0),
      0,
    );
  }

  static getLatestBackup(groups: BackupCatalogGroupView[]): BackupCatalogItemView | null {
    const items = groups.flatMap((group) => group.items);
    if (!items.length) return null;
    return [...items].sort((left, right) => Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt))[0] || null;
  }

  static getGroupDescription(groupKey: BackupCatalogGroupView['key']): string {
    if (groupKey === 'system') return 'Framework snapshots for full-system rollback and safety checkpoints.';
    if (groupKey === 'plugins') return 'Plugin-specific archives created during installs, updates, or manual protection.';
    if (groupKey === 'themes') return 'Theme snapshots captured before overwrite or restore operations.';
    if (groupKey === 'database') return 'Database-only dumps retained separately from tarball snapshots.';
    return 'Site-transfer bundles and related artifacts staged for migration workflows.';
  }

  static getScopeLabel(item: BackupCatalogItemView): string {
    if (item.group === 'plugins' && item.scopeSlug) return `Plugin: ${item.scopeSlug}`;
    if (item.group === 'themes' && item.scopeSlug) return `Theme: ${item.scopeSlug}`;
    if (item.group === 'database') return 'Database';
    if (item.group === 'transfer') return 'Site Transfer';
    return 'System';
  }

  static getStorageLabel(item: BackupCatalogItemView): string {
    return item.rootKind === 'site-transfer' ? 'artifacts/site-transfer' : 'backups';
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

  static getDownloadProgressLabel(progress: BackupDownloadProgressView): string {
    if (progress.percent === null) {
      return `Downloading ${this.formatBytes(progress.loadedBytes)}...`;
    }
    return `Downloading ${progress.percent}%`;
  }

  static getDownloadProgressDetail(progress: BackupDownloadProgressView): string {
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

  private static getSectionSortIndex(value: 'core' | 'database' | 'plugins' | 'themes'): number {
    return ['core', 'database', 'plugins', 'themes'].indexOf(value);
  }
}