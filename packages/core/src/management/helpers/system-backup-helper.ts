import fs from 'fs';
import path from 'path';
import { BackupSectionKey } from '@core/management/enums/backup-section-key.enum';
import { BackupArchivePathService } from '@core/management/helpers/backup-archive-path-service';

/**
 * Pure, stateless helpers for the system-backup flow — section resolution, root-entry collection,
 * included-section derivation, and temp/old-file cleanup. Split out of BackupService to keep that
 * file under the size limit. These hold no backup-dir state; callers pass the resolved paths in.
 */
export class SystemBackupHelper {
  static isDatabaseOnlyRequest(requestedSections: BackupSectionKey[]): boolean {
    return requestedSections.length === 1 && requestedSections[0] === BackupSectionKey.DATABASE;
  }

  static resolveRequestedSections(sections?: BackupSectionKey[]): BackupSectionKey[] {
    const allowedSections: BackupSectionKey[] = BackupSectionKey.values() as BackupSectionKey[];
    if (sections === undefined) {
      return [...allowedSections];
    }

    return Array.from(new Set(
      sections.filter((section): section is BackupSectionKey => allowedSections.includes(section)),
    ));
  }

  static collectSystemEntries(
    rootDir: string,
    requestedSections: BackupSectionKey[],
    excludePaths?: string[],
  ): string[] {
    return fs.readdirSync(rootDir).filter((item) => {
      if (
        item === 'node_modules' ||
        item === 'backups' ||
        item.startsWith('.') ||
        item.startsWith('tmp-') ||
        BackupArchivePathService.isTopLevelEntryExcluded(item, excludePaths)
      ) {
        return false;
      }

      if (item === 'plugins') {
        return requestedSections.includes(BackupSectionKey.PLUGINS);
      }
      if (item === 'themes') {
        return requestedSections.includes(BackupSectionKey.THEMES);
      }
      return requestedSections.includes(BackupSectionKey.CORE);
    });
  }

  static resolveIncludedSections(
    requestedSections: BackupSectionKey[],
    rootEntries: string[],
    tempDbFile: string | null,
  ): BackupSectionKey[] {
    const includesCoreFiles = rootEntries.some((entry) => entry !== 'plugins' && entry !== 'themes');
    const includedSections: BackupSectionKey[] = [];

    if (requestedSections.includes(BackupSectionKey.CORE) && includesCoreFiles) {
      includedSections.push(BackupSectionKey.CORE);
    }
    if (requestedSections.includes(BackupSectionKey.DATABASE) && Boolean(tempDbFile)) {
      includedSections.push(BackupSectionKey.DATABASE);
    }
    if (requestedSections.includes(BackupSectionKey.PLUGINS) && rootEntries.includes('plugins')) {
      includedSections.push(BackupSectionKey.PLUGINS);
    }
    if (requestedSections.includes(BackupSectionKey.THEMES) && rootEntries.includes('themes')) {
      includedSections.push(BackupSectionKey.THEMES);
    }

    return includedSections;
  }

  static cleanupTemporaryDatabaseEntry(rootDir: string, tempDbFile: string | null): void {
    if (!tempDbFile) {
      return;
    }

    const temporaryPath = path.join(rootDir, tempDbFile);
    if (fs.existsSync(temporaryPath)) {
      fs.unlinkSync(temporaryPath);
    }
  }

  static cleanupDatabaseOld(databaseDir: string, keep: number = 5): void {
    if (!fs.existsSync(databaseDir)) return;

    const files = fs.readdirSync(databaseDir)
      .filter((fileName) =>
        (fileName.startsWith('db-dump-') && fileName.endsWith('.sql'))
        || (fileName.startsWith('db-copy-') && fileName.endsWith('.db')),
      )
      .map((fileName) => ({
        name: fileName,
        time: fs.statSync(path.join(databaseDir, fileName)).mtime.getTime(),
      }))
      .sort((left, right) => right.time - left.time);

    if (files.length > keep) {
      files.slice(keep).forEach((file) => {
        try {
          fs.unlinkSync(path.join(databaseDir, file.name));
        } catch {
          // Ignore errors during cleanup.
        }
      });
    }
  }
}
