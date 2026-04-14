import fs from 'fs';
import path from 'path';
import { ProjectPaths } from '../config/paths';
import { BackupService } from './backup-service';
import { BackupOperationError } from './backup-operation-error';
import type {
  BackupCatalogGroup,
  BackupCatalogGroupKey,
  BackupCatalogItem,
  BackupCatalogResolvedItem,
  BackupCatalogRootKind,
} from './backup-catalog-service.types';

export class BackupCatalogService {
  private static readonly GROUP_LABELS: Record<BackupCatalogGroupKey, string> = {
    system: 'System',
    plugins: 'Plugins',
    themes: 'Themes',
    database: 'Database',
    transfer: 'Site Transfer',
  };

  async listBackupGroups(includeTransferArtifacts: boolean = false): Promise<BackupCatalogGroup[]> {
    const items = await this.listItems(includeTransferArtifacts);
    const groups = new Map<BackupCatalogGroupKey, BackupCatalogItem[]>();

    for (const item of items) {
      const existingItems = groups.get(item.group) || [];
      existingItems.push(item);
      groups.set(item.group, existingItems);
    }

    return Array.from(groups.entries())
      .map(([key, groupItems]) => ({
        key,
        label: BackupCatalogService.GROUP_LABELS[key],
        items: groupItems.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt)),
      }))
      .sort((left, right) => this.groupPriority(left.key) - this.groupPriority(right.key));
  }

  async resolveById(id: string): Promise<BackupCatalogResolvedItem> {
    const decodedValue = this.decodeId(id);
    const separatorIndex = decodedValue.indexOf(':');
    if (separatorIndex <= 0) {
      throw new BackupOperationError(400, 'Invalid backup identifier.');
    }

    const rootKind = decodedValue.slice(0, separatorIndex) as BackupCatalogRootKind;
    const relativePath = decodedValue.slice(separatorIndex + 1);
    const baseDirectory = this.getRootDirectory(rootKind);
    const absolutePath = this.resolveSafePath(baseDirectory, relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new BackupOperationError(404, 'Backup archive was not found.');
    }

    return this.createResolvedItem(rootKind, baseDirectory, absolutePath);
  }

  resolveByPath(absolutePath: string, rootKind: BackupCatalogRootKind = 'backups'): BackupCatalogResolvedItem {
    const baseDirectory = this.getRootDirectory(rootKind);
    const resolvedPath = this.resolveSafePath(baseDirectory, path.relative(baseDirectory, absolutePath));
    return this.createResolvedItem(rootKind, baseDirectory, resolvedPath);
  }

  private async listItems(includeTransferArtifacts: boolean): Promise<BackupCatalogResolvedItem[]> {
    const backupItems = this.collectItems(this.getRootDirectory('backups'), 'backups');
    const transferItems = includeTransferArtifacts
      ? this.collectItems(this.getRootDirectory('site-transfer'), 'site-transfer')
      : [];

    return [...backupItems, ...transferItems].sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
  }

  private collectItems(baseDirectory: string, rootKind: BackupCatalogRootKind): BackupCatalogResolvedItem[] {
    if (!fs.existsSync(baseDirectory) || !fs.statSync(baseDirectory).isDirectory()) {
      return [];
    }

    const filePaths: string[] = [];
    this.walkDirectory(baseDirectory, filePaths);

    return filePaths
      .filter((filePath) => this.isSupportedBackupFile(filePath, rootKind))
      .map((filePath) => this.createResolvedItem(rootKind, baseDirectory, filePath));
  }

  private createResolvedItem(
    rootKind: BackupCatalogRootKind,
    baseDirectory: string,
    absolutePath: string,
  ): BackupCatalogResolvedItem {
    const stats = fs.statSync(absolutePath);
    const relativePath = path.relative(baseDirectory, absolutePath).replace(/\\/g, '/');
    const filename = path.basename(absolutePath);
    const group = this.resolveGroup(rootKind, relativePath);
    const scopeSlug = this.resolveScopeSlug(group, filename);

    return {
      id: this.encodeId(rootKind, relativePath),
      filename,
      displayName: this.resolveDisplayName(group, filename, scopeSlug),
      group,
      rootKind,
      scopeSlug,
      sizeBytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      absolutePath,
      relativePath,
    };
  }

  private resolveGroup(rootKind: BackupCatalogRootKind, relativePath: string): BackupCatalogGroupKey {
    if (rootKind === 'site-transfer') {
      return 'transfer';
    }

    const normalizedPath = relativePath.replace(/\\/g, '/');
    if (normalizedPath.startsWith('system/')) return 'system';
    if (normalizedPath.startsWith('plugins/')) return 'plugins';
    if (normalizedPath.startsWith('themes/')) return 'themes';
    if (normalizedPath.startsWith('database/')) return 'database';
    return 'system';
  }

  private resolveScopeSlug(group: BackupCatalogGroupKey, filename: string): string | null {
    if (group !== 'plugins' && group !== 'themes') {
      return null;
    }

    const match = filename.match(/^([a-z0-9][a-z0-9-_]*?)-\d{4}-\d{2}-\d{2}/i);
    return match ? String(match[1] || '').toLowerCase() : null;
  }

  private resolveDisplayName(group: BackupCatalogGroupKey, filename: string, scopeSlug: string | null): string {
    if (group === 'plugins' && scopeSlug) {
      return `Plugin ${scopeSlug}`;
    }
    if (group === 'themes' && scopeSlug) {
      return `Theme ${scopeSlug}`;
    }
    if (group === 'database') {
      return 'Database backup';
    }
    if (group === 'transfer') {
      return filename;
    }
    return 'System backup';
  }

  private isSupportedBackupFile(filePath: string, rootKind: BackupCatalogRootKind): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');
    if (rootKind === 'site-transfer') {
      return normalizedPath.endsWith('/site-snapshot.tar.gz');
    }

    return normalizedPath.endsWith('.tar.gz') || normalizedPath.endsWith('.sql') || normalizedPath.endsWith('.db');
  }

  private walkDirectory(directoryPath: string, results: string[]): void {
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        this.walkDirectory(entryPath, results);
        continue;
      }
      if (entry.isFile()) {
        results.push(entryPath);
      }
    }
  }

  private getRootDirectory(rootKind: BackupCatalogRootKind): string {
    if (rootKind === 'site-transfer') {
      return ProjectPaths.getRepositoryArtifactsDir('site-transfer');
    }
    return BackupService.getBackupsDirectory();
  }

  private resolveSafePath(baseDirectory: string, relativePath: string): string {
    const resolvedPath = path.resolve(baseDirectory, relativePath);
    const normalizedBaseDirectory = this.normalizeExistingPath(baseDirectory);
    const normalizedResolvedPath = this.normalizeExistingPath(resolvedPath);
    if (!normalizedResolvedPath.startsWith(`${normalizedBaseDirectory}${path.sep}`) && normalizedResolvedPath !== normalizedBaseDirectory) {
      throw new BackupOperationError(400, 'Resolved backup path escapes the allowed directory.');
    }
    return resolvedPath;
  }

  private normalizeExistingPath(filePath: string): string {
    try {
      return fs.realpathSync.native(filePath);
    } catch {
      return path.resolve(filePath);
    }
  }

  private encodeId(rootKind: BackupCatalogRootKind, relativePath: string): string {
    return Buffer.from(`${rootKind}:${relativePath}`, 'utf8').toString('base64url');
  }

  private decodeId(id: string): string {
    try {
      return Buffer.from(id, 'base64url').toString('utf8');
    } catch {
      throw new BackupOperationError(400, 'Invalid backup identifier encoding.');
    }
  }

  private groupPriority(key: BackupCatalogGroupKey): number {
    return ['system', 'plugins', 'themes', 'database', 'transfer'].indexOf(key);
  }
}