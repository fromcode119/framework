import fs from 'fs';
import path from 'path';
import * as tar from 'tar';
import AdmZip from 'adm-zip';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ProjectPaths } from '../config/paths';

const execAsync = promisify(exec);

/**
 * Backup Service
 * Handles creating and restoring backups of directories
 * Useful for rollbacks during failed updates or migrations.
 */
export class BackupService {
  private static getBackupsDir(): string {
    return path.resolve(ProjectPaths.getProjectRoot(), 'backups');
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

    // Ensure target parent exists
    if (!fs.existsSync(path.dirname(targetDir))) {
        fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    }

    // Extraction will overwrite existing files
    await tar.extract({
      file: backupPath,
      cwd: path.dirname(targetDir),
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
    
    if (dbUrl.startsWith('postgres') || dbUrl.startsWith('postgresql')) {
      const dumpPath = path.join(backupsPath, `db-dump-${timestamp}.sql`);
      try {
        // Use pg_dump if available. We assume it's in the PATH (installed in Dockerfile)
        await execAsync(`pg_dump "${dbUrl}" > "${dumpPath}"`);
        return dumpPath;
      } catch (err: any) {
        console.error(`[BackupService] PostgreSQL dump failed: ${err.message}`);
        // If pg_dump fails, we might still want to proceed with other backups
        return null;
      }
    } else if (dbUrl.includes('.db') || dbUrl.startsWith('sqlite')) {
      // Handle SQLite
      const sqlitePath = dbUrl.startsWith('sqlite://') ? dbUrl.replace('sqlite://', '') : dbUrl;
      const absPath = path.isAbsolute(sqlitePath) ? sqlitePath : path.resolve(ProjectPaths.getProjectRoot(), sqlitePath);
      
      if (fs.existsSync(absPath)) {
        const dumpPath = path.join(backupsPath, `db-copy-${timestamp}.db`);
        fs.copyFileSync(absPath, dumpPath);
        return dumpPath;
      }
    }

    return null;
  }

  /**
   * Creates a full system backup
   * @returns The path to the created backup file
   */
  static async createSystemBackup(): Promise<string> {
    const backupsPath = this.ensureBackupsDir('system');
    const rootDir = ProjectPaths.getProjectRoot();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `system-${timestamp}.tar.gz`;
    const backupPath = path.join(backupsPath, backupFileName);

    // 1. First, create a database dump
    let dbDumpPath: string | null = null;
    try {
      dbDumpPath = await this.backupDatabase();
    } catch (e) {
      console.warn('[BackupService] Database backup failed, proceeding with files only.');
    }

    // 2. List of things to backup (essentially everything except node_modules and backups)
    const items = fs.readdirSync(rootDir);
    const toBackup = items.filter(item => 
      item !== 'node_modules' && 
      item !== 'backups' && 
      !item.startsWith('.') &&
      !item.startsWith('tmp-')
    );

    // 3. If we have a DB dump, copy it to a temporary location in root so it's included in the tarball
    let tempDbFile: string | null = null;
    if (dbDumpPath && fs.existsSync(dbDumpPath)) {
      tempDbFile = `database-backup-${timestamp}${path.extname(dbDumpPath)}`;
      fs.copyFileSync(dbDumpPath, path.join(rootDir, tempDbFile));
      toBackup.push(tempDbFile);
    }

    // 4. Create the tarball
    try {
      await tar.create(
        {
          gzip: true,
          file: backupPath,
          cwd: rootDir,
        },
        toBackup
      );
    } finally {
      // 5. Cleanup the temporary file in root
      if (tempDbFile && fs.existsSync(path.join(rootDir, tempDbFile))) {
        fs.unlinkSync(path.join(rootDir, tempDbFile));
      }
    }

    this.cleanupOld('system', 'system', 5);

    return backupPath;
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
}