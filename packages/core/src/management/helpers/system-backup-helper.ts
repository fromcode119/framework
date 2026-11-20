import fs from 'fs';
import path from 'path';
import * as tar from 'tar';
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

  /**
   * Writes the archive and answers with the entries it had to leave out as unreadable. An archive that
   * fails part-way is removed: half of one would sit in the list as if it were a backup.
   */
  static async writeArchive(rootDir: string, backupPath: string, entries: string[], excludePaths?: string[]): Promise<string[]> {
    const unreadable: string[] = [];
    try {
      await tar.create(
        {
          filter: (entryPath, stat) => !BackupArchivePathService.isArchivePathExcluded(String(entryPath || ''), excludePaths)
            && SystemBackupHelper.isReadableEntry(rootDir, String(entryPath || ''), stat as fs.Stats, unreadable),
          gzip: true,
          file: backupPath,
          cwd: rootDir,
        },
        entries,
      );
    } catch (error) {
      fs.rmSync(backupPath, { force: true });
      throw error;
    }
    return unreadable;
  }

  /**
   * Whether the archive can take this entry. A directory or file the server's own user may not read
   * used to stop the whole archive part-way (`EACCES ... scandir`); it is left out instead and
   * recorded in `unreadable`, so the finished backup names what it does not hold.
   */
  static isReadableEntry(rootDir: string, entryPath: string, stat: { isDirectory(): boolean; isFile(): boolean } | undefined, unreadable: string[]): boolean {
    if (!stat || (!stat.isDirectory() && !stat.isFile())) return true;
    try {
      fs.accessSync(path.resolve(rootDir, entryPath), stat.isDirectory() ? fs.constants.R_OK | fs.constants.X_OK : fs.constants.R_OK);
      return true;
    } catch {
      unreadable.push(entryPath);
      return false;
    }
  }

  /** The warning for entries left out as unreadable, or nothing when the archive holds everything. */
  static unreadableWarnings(unreadable: string[]): string[] {
    if (!unreadable.length) return [];
    const shown = unreadable.slice(0, 20).join(', ');
    const more = unreadable.length > 20 ? ` and ${unreadable.length - 20} more` : '';
    return [`Left out of the backup because the server cannot read them: ${shown}${more}.`];
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

  private static readonly TEMPORARY_DATABASE_PREFIX = 'database-backup-';

  /**
   * The path, relative to the project root, the archive takes the database dump from.
   *
   * A dump already inside the project root (the backups folder normally is) is archived where it lies.
   * It used to be copied into the root first, and on an installation that runs from a published image
   * the root is not writable by the server's user — so the copy failed and every archive was written
   * without its database. Only a dump kept outside the root still needs the copy.
   */
  static databaseArchiveEntry(rootDir: string, dbDumpPath: string, timestamp: string): string {
    const relative = path.relative(rootDir, dbDumpPath);
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
      return relative.split(path.sep).join('/');
    }
    const temporary = `${SystemBackupHelper.TEMPORARY_DATABASE_PREFIX}${timestamp}${path.extname(dbDumpPath)}`;
    fs.copyFileSync(dbDumpPath, path.join(rootDir, temporary));
    return temporary;
  }

  /** Removes the copy `databaseArchiveEntry` made in the root — never a dump archived where it lay. */
  static cleanupTemporaryDatabaseEntry(rootDir: string, tempDbFile: string | null): void {
    if (!tempDbFile || tempDbFile.includes('/') || !tempDbFile.startsWith(SystemBackupHelper.TEMPORARY_DATABASE_PREFIX)) {
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
