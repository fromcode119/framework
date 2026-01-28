import fs from 'fs';
import path from 'path';
import * as tar from 'tar';
import AdmZip from 'adm-zip';

/**
 * Backup Service
 * Handles creating and restoring backups of directories
 * Useful for rollbacks during failed updates or migrations.
 */
export class BackupService {
  private static backupsDir = path.resolve(process.cwd(), 'backups');

  /**
   * Initializes the backups directory
   */
  private static ensureBackupsDir(subDir?: string) {
    const target = subDir ? path.join(this.backupsDir, subDir) : this.backupsDir;
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
      
      const isZip = url.toLowerCase().includes('.zip') || url.includes('/zip/');
      const tempFile = path.join(this.backupsDir, `download-${Date.now()}${isZip ? '.zip' : '.tar.gz'}`);
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
   * Cleans up old backups for a specific slug, keeping only the most recent N
   */
  private static cleanupOld(slug: string, type: string, keep: number = 3) {
    const dir = path.join(this.backupsDir, type);
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
