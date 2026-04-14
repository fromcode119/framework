import path from 'path';
import * as tar from 'tar';

export class BackupArchivePathService {
  static isTopLevelEntryExcluded(entryName: string, excludePaths?: string[]): boolean {
    const normalizedEntryName = this.normalizePath(entryName);
    return this.normalizeExcludePaths(excludePaths).some((excludePath) => excludePath === normalizedEntryName);
  }

  static isArchivePathExcluded(entryPath: string, excludePaths?: string[]): boolean {
    const normalizedEntryPath = this.normalizePath(entryPath);
    return this.normalizeExcludePaths(excludePaths).some((excludePath) => {
      return normalizedEntryPath === excludePath || normalizedEntryPath.startsWith(`${excludePath}/`);
    });
  }

  static async resolveRestoreDirectory(backupPath: string, targetDir: string): Promise<string> {
    const topLevelSegments = new Set<string>();

    await tar.list({
      file: backupPath,
      onentry: (entry) => {
        const firstSegment = String(entry.path || '').split('/').filter(Boolean)[0];
        if (firstSegment) {
          topLevelSegments.add(firstSegment);
        }
      },
    });

    if (topLevelSegments.size === 1 && topLevelSegments.has(path.basename(targetDir))) {
      return path.dirname(targetDir);
    }

    return targetDir;
  }

  private static normalizeExcludePaths(excludePaths?: string[]): string[] {
    if (!Array.isArray(excludePaths) || excludePaths.length === 0) {
      return [];
    }

    return excludePaths
      .map((excludePath) => this.normalizePath(excludePath))
      .filter((excludePath) => excludePath.length > 0);
  }

  private static normalizePath(value: string): string {
    return String(value || '')
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/^\/+|\/+$/g, '');
  }
}