import fs from 'fs';
import path from 'path';
import * as tar from 'tar';
import AdmZip from 'adm-zip';
import { DatabaseFactory } from '@fromcode119/database';
import { ProjectPaths } from '../config/paths';
import type { CreateSystemBackupOptions, CreateSystemBackupResult } from './backup-service.interfaces';
import type { BackupSectionKey } from './backup-service.types';
import { BackupArchivePathService } from './helpers/backup-archive-path-service';

/**
 * Backup Service
 * Handles creating and restoring backups of directories
 * Useful for rollbacks during failed updates or migrations.
 */
export class BackupService {
  private static getBackupsDir(): string {
    return path.resolve(ProjectPaths.getProjectRoot(), 'backups');
  }

  static getBackupsDirectory(subDir?: string): string {
    return subDir ? path.join(this.getBackupsDir(), subDir) : this.getBackupsDir();
  }

  /**
   * Initializes the backups directory
   */
  private static ensureBackupsDir(subDir?: string) {
    const backupsDir = this.getBackupsDir();
    const target = subDir ? path.join(backupsDir, subDir) : backupsDir;
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    return target;
  }

  /**
   * Creates a backup of a directory
   * @param slug - The slug of the entity (plugin/theme)
   * @param entityPath - The absolute path to the directory
   * @param type - Optional subfolder for organization
   * @returns The path to the created backup file
   */
  static async create(slug: string, entityPath: string, type: 'plugins' | 'themes' = 'plugins'): Promise<string> {
    const backupsPath = this.ensureBackupsDir(type);
    
    if (!fs.existsSync(entityPath)) {
      throw new Error(`Path does not exist: ${entityPath}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${slug}-${timestamp}.tar.gz`;
    const backupPath = path.join(backupsPath, backupFileName);

    await tar.create(
      {
        gzip: true,
        file: backupPath,
        cwd: path.dirname(entityPath),
      },
      [path.basename(entityPath)]
    );

    // Optional: Cleanup old backups (keep last 3)
    this.cleanupOld(slug, type);

    return backupPath;
  }

  /**
   * Restores from a backup file
   * @param backupPath - The path to the backup file
   * @param targetDir - The directory where it should be extracted
   */
  static async restore(backupPath: string, targetDir: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file does not exist: ${backupPath}`);
    }

    const extractionDirectory = await BackupArchivePathService.resolveRestoreDirectory(backupPath, targetDir);
    if (!fs.existsSync(extractionDirectory)) {
        fs.mkdirSync(extractionDirectory, { recursive: true });
    }

    // Extraction will overwrite existing files
    await tar.extract({
      file: backupPath,
      cwd: extractionDirectory,
    });
  }

  /**
   * Downloads from a URL and extracts to the target directory
   * @param url - The URL to download from
   * @param targetDir - The directory where it should be extracted
   */
  static async downloadAndExtract(url: string, targetDir: string): Promise<void> {
    this.ensureBackupsDir();

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      // Convert Web Stream to Node Stream for tar/zip
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const contentType = response.headers.get('content-type');
      const isZip = url.toLowerCase().includes('.zip') || 
                    url.includes('/zip/') || 
                    response.url.toLowerCase().includes('.zip') ||
                    contentType === 'application/zip' || 
                    contentType === 'application/x-zip-compressed';

      const tempFile = path.join(this.getBackupsDir(), `download-${Date.now()}${isZip ? '.zip' : '.tar.gz'}`);
      fs.writeFileSync(tempFile, buffer);

      // Extract to target
      if (isZip) {
        const zip = new AdmZip(tempFile);
        zip.extractAllTo(targetDir, true);
      } else {
        await tar.extract({
          file: tempFile,
          cwd: targetDir,
        });
      }

      try {
        fs.unlinkSync(tempFile);
      } catch (e) {}
    } catch (err) {
      throw new Error(`Download/extraction failed: ${err}`);
    }
  }

  /**
   * Creates a database dump
   * @returns Path to the dump file
   */
  static async backupDatabase(): Promise<string | null> {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return null;

    const backupsPath = this.ensureBackupsDir('database');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const projectRoot = ProjectPaths.getProjectRoot();

    const backupHandler = DatabaseFactory.createBackupHandler(dbUrl);
    if (!backupHandler) {
      return null;
    }

    return await backupHandler.createBackup(dbUrl, { backupsPath, timestamp, projectRoot });
  }

  /**
   * Creates a full system backup
   * @returns The path to the created backup file
   */
  static async createSystemBackup(options: CreateSystemBackupOptions = {}): Promise<string> {
    const result = await this.createSystemBackupBundle(options);
    return result.backupPath;
  }

  static async createSystemBackupBundle(options: CreateSystemBackupOptions = {}): Promise<CreateSystemBackupResult> {
    const backupsPath = this.ensureBackupsDir('system');
    const rootDir = ProjectPaths.getProjectRoot();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `system-${timestamp}.tar.gz`;
    const backupPath = path.join(backupsPath, backupFileName);
    const requestedSections = this.resolveRequestedSections(options.sections);

    if (this.isDatabaseOnlyRequest(requestedSections)) {
      return await this.createDatabaseOnlyBackup(requestedSections);
    }

    const rootEntries = this.collectSystemEntries(rootDir, requestedSections, options.excludePaths);
    const databaseEntry = await this.prepareDatabaseEntry(rootDir, requestedSections, timestamp);
    const toBackup = databaseEntry.tempDbFile ? [...rootEntries, databaseEntry.tempDbFile] : rootEntries;
    const includedSections = this.resolveIncludedSections(requestedSections, rootEntries, databaseEntry.tempDbFile);

    if (!toBackup.length) {
      throw new Error('Select at least one backup section that is available in this workspace.');
    }

    try {
      await tar.create(
        {
          filter: (entryPath) => !BackupArchivePathService.isArchivePathExcluded(String(entryPath || ''), options.excludePaths),
          gzip: true,
          file: backupPath,
          cwd: rootDir,
        },
        toBackup,
      );
    } finally {
      this.cleanupTemporaryDatabaseEntry(rootDir, databaseEntry.tempDbFile);
    }

    this.cleanupOld('system', 'system', 5);

    return {
      backupPath,
      requestedSections,
      includedSections,
      warnings: databaseEntry.warnings,
    };
  }

  private static isDatabaseOnlyRequest(requestedSections: BackupSectionKey[]): boolean {
    return requestedSections.length === 1 && requestedSections[0] === 'database';
  }

  private static async createDatabaseOnlyBackup(requestedSections: BackupSectionKey[]): Promise<CreateSystemBackupResult> {
    const backupPath = await this.backupDatabase();
    if (!backupPath || !fs.existsSync(backupPath)) {
      throw new Error('Database backup was requested, but no database snapshot is available in this environment.');
    }

    this.cleanupDatabaseOld(5);

    return {
      backupPath,
      requestedSections,
      includedSections: ['database'],
      warnings: [],
    };
  }

  private static resolveRequestedSections(sections?: BackupSectionKey[]): BackupSectionKey[] {
    const allowedSections: BackupSectionKey[] = ['core', 'database', 'plugins', 'themes'];
    if (sections === undefined) {
      return [...allowedSections];
    }

    return Array.from(new Set(
      sections.filter((section): section is BackupSectionKey => allowedSections.includes(section)),
    ));
  }

  private static collectSystemEntries(
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
        return requestedSections.includes('plugins');
      }
      if (item === 'themes') {
        return requestedSections.includes('themes');
      }
      return requestedSections.includes('core');
    });
  }

  private static async prepareDatabaseEntry(
    rootDir: string,
    requestedSections: BackupSectionKey[],
    timestamp: string,
  ): Promise<{ tempDbFile: string | null; warnings: string[] }> {
    if (!requestedSections.includes('database')) {
      return { tempDbFile: null, warnings: [] };
    }

    try {
      const dbDumpPath = await this.backupDatabase();
      if (!dbDumpPath || !fs.existsSync(dbDumpPath)) {
        return {
          tempDbFile: null,
          warnings: ['Database backup was requested, but no database snapshot was available in this environment.'],
        };
      }

      const tempDbFile = `database-backup-${timestamp}${path.extname(dbDumpPath)}`;
      fs.copyFileSync(dbDumpPath, path.join(rootDir, tempDbFile));
      return { tempDbFile, warnings: [] };
    } catch {
      console.warn('[BackupService] Database backup failed, proceeding without a database snapshot.');
      return {
        tempDbFile: null,
        warnings: ['Database backup failed, so the archive contains files only.'],
      };
    }
  }

  private static resolveIncludedSections(
    requestedSections: BackupSectionKey[],
    rootEntries: string[],
    tempDbFile: string | null,
  ): BackupSectionKey[] {
    const includesCoreFiles = rootEntries.some((entry) => entry !== 'plugins' && entry !== 'themes');
    const includedSections: BackupSectionKey[] = [];

    if (requestedSections.includes('core') && includesCoreFiles) {
      includedSections.push('core');
    }
    if (requestedSections.includes('database') && Boolean(tempDbFile)) {
      includedSections.push('database');
    }
    if (requestedSections.includes('plugins') && rootEntries.includes('plugins')) {
      includedSections.push('plugins');
    }
    if (requestedSections.includes('themes') && rootEntries.includes('themes')) {
      includedSections.push('themes');
    }

    return includedSections;
  }

  private static cleanupTemporaryDatabaseEntry(rootDir: string, tempDbFile: string | null): void {
    if (!tempDbFile) {
      return;
    }

    const temporaryPath = path.join(rootDir, tempDbFile);
    if (fs.existsSync(temporaryPath)) {
      fs.unlinkSync(temporaryPath);
    }
  }

  /**
   * Cleans up old backups for a specific slug, keeping only the most recent N
   */
  private static cleanupOld(slug: string, type: string, keep: number = 3) {
    const dir = path.join(this.getBackupsDir(), type);
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith(`${slug}-`) && f.endsWith('.tar.gz'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(dir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > keep) {
      files.slice(keep).forEach(f => {
        try {
          fs.unlinkSync(path.join(dir, f.name));
        } catch (e) {
          // Ignore errors during cleanup
        }
      });
    }
  }

  private static cleanupDatabaseOld(keep: number = 5): void {
    const dir = path.join(this.getBackupsDir(), 'database');
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir)
      .filter((fileName) =>
        (fileName.startsWith('db-dump-') && fileName.endsWith('.sql'))
        || (fileName.startsWith('db-copy-') && fileName.endsWith('.db')),
      )
      .map((fileName) => ({
        name: fileName,
        time: fs.statSync(path.join(dir, fileName)).mtime.getTime(),
      }))
      .sort((left, right) => right.time - left.time);

    if (files.length > keep) {
      files.slice(keep).forEach((file) => {
        try {
          fs.unlinkSync(path.join(dir, file.name));
        } catch {
          // Ignore errors during cleanup.
        }
      });
    }
  }

}