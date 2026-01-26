import fs from 'fs';
import path from 'path';
import * as tar from 'tar';
import AdmZip from 'adm-zip';

/**
 * Plugin Backup Service
 * Handles creating and restoring backups of plugin directories
 * Useful for rollbacks during failed updates or migrations.
 */
export class PluginBackupService {
  private static backupsDir = path.resolve(process.cwd(), 'backups/plugins');

  /**
   * Initializes the backups directory
   */
  private static ensureBackupsDir() {
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
  }

  /**
   * Creates a backup of a plugin directory
   * @param pluginSlug - The slug of the plugin
   * @param pluginPath - The absolute path to the plugin directory
   * @returns The path to the created backup file
   */
  static async createBackup(pluginSlug: string, pluginPath: string): Promise<string> {
    this.ensureBackupsDir();
    
    if (!fs.existsSync(pluginPath)) {
      throw new Error(`Plugin path does not exist: ${pluginPath}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${pluginSlug}-${timestamp}.tar.gz`;
    const backupPath = path.join(this.backupsDir, backupFileName);

    await tar.create(
      {
        gzip: true,
        file: backupPath,
        cwd: path.dirname(pluginPath),
      },
      [path.basename(pluginPath)]
    );

    // Optional: Cleanup old backups (keep last 3)
    this.cleanupOldBackups(pluginSlug);

    return backupPath;
  }

  /**
   * Restores a plugin from a backup file
   * @param backupPath - The path to the backup file
   * @param targetDir - The directory where the plugin should be extracted
   */
  static async restoreBackup(backupPath: string, targetDir: string): Promise<void> {
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
   * Downloads a plugin from a URL and extracts it to the target directory
   * @param url - The URL to download the plugin from
   * @param targetDir - The directory where the plugin should be extracted
   */
  static async downloadAndExtractPlugin(url: string, targetDir: string): Promise<void> {
    this.ensureBackupsDir();

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download plugin: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      // Convert Web Stream to Node Stream for tar/zip
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const isZip = url.endsWith('.zip');
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
      throw new Error(`Plugin download/extraction failed: ${err}`);
    }
  }

  /**
   * Cleans up old backups for a specific plugin, keeping only the most recent N
   */
  private static cleanupOldBackups(pluginSlug: string, keep: number = 3) {
    if (!fs.existsSync(this.backupsDir)) return;

    const files = fs.readdirSync(this.backupsDir)
      .filter(f => f.startsWith(`${pluginSlug}-`) && f.endsWith('.tar.gz'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(this.backupsDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > keep) {
      files.slice(keep).forEach(f => {
        try {
          fs.unlinkSync(path.join(this.backupsDir, f.name));
        } catch (e) {
          // Ignore errors during cleanup
        }
      });
    }
  }
}
