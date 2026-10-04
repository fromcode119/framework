import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BackupService } from '@core/management/backup-service';
import { BackupSectionKey } from '@core/management/enums/backup-section-key.enum';
import { ExtensionDirectorySwap } from '@core/extensions/extension-directory-swap';
import type { Logger } from '@core/logging';

/**
 * An install whose migrations fail leaves the plugin's files as they were.
 *
 * The new files are put in place first and the plugin's migrations run after, so a migration that
 * failed used to leave the NEW files on disk under the OLD registered version: the running process kept
 * the old code, and the next restart loaded code whose migrations had never run. The installer already
 * backs the old directory up before replacing it; this puts that backup back. A plugin that had no
 * directory before the install is removed again.
 */
export class PluginInstallRollback {
  constructor(
    private readonly pluginsRoot: string,
    private readonly logger: Logger,
  ) {}

  async runOrRestore(slug: string, startedAt: number, step: () => Promise<void>): Promise<void> {
    try {
      await step();
    } catch (error) {
      await this.restore(slug, startedAt).catch((restoreError: unknown) => {
        this.logger.error(`Could not put "${slug}" back after a failed install: ${String((restoreError as Error)?.message || restoreError)}`);
      });
      throw error;
    }
  }

  /**
   * The newest backup of `slug` written at or after `sinceMs`, or null. Matched on the exact slug plus
   * the timestamp that follows it, so `shop` never picks up a backup of `shop-extra`.
   */
  static latestBackupSince(slug: string, sinceMs: number): string | null {
    const dir = BackupService.getBackupsDirectory(BackupSectionKey.PLUGINS.value);
    if (!fs.existsSync(dir)) return null;
    const escaped = slug.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
    const own = new RegExp('^' + escaped + '-\\d{4}-\\d{2}-\\d{2}T.*\\.tar\\.gz$');
    const newest = fs.readdirSync(dir)
      .filter((name) => own.test(name))
      .map((name) => ({ file: path.join(dir, name), time: fs.statSync(path.join(dir, name)).mtimeMs }))
      .filter((entry) => entry.time >= sinceMs)
      .sort((a, b) => b.time - a.time)[0];
    return newest?.file ?? null;
  }

  private async restore(slug: string, startedAt: number): Promise<void> {
    const targetDir = path.join(this.pluginsRoot, slug);
    const backup = PluginInstallRollback.latestBackupSince(slug, startedAt);
    if (!backup) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      this.logger.warn(`Install of "${slug}" failed; its files were removed, as it was not installed before.`);
      return;
    }
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-plugin-restore-'));
    try {
      await BackupService.restore(backup, scratch);
      const restored = path.join(scratch, slug);
      await ExtensionDirectorySwap.replace(targetDir, async (stagingDir) => {
        fs.cpSync(fs.existsSync(restored) ? restored : scratch, stagingDir, { recursive: true });
      });
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
    this.logger.warn(`Install of "${slug}" failed; the previous files were put back from ${path.basename(backup)}.`);
  }
}
