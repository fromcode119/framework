import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BackupService } from '@core/management/backup-service';
import { PluginInstallRollback } from '@core/plugin/services/installation/plugin-install-rollback';
import { BackupSectionKey } from '@core/management/enums/backup-section-key.enum';

describe('PluginInstallRollback.latestBackupSince', () => {
  let root = '';

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const backup = (name: string, mtimeMs: number): void => {
    const file = path.join(root, BackupSectionKey.PLUGINS.value, name);
    fs.writeFileSync(file, '');
    fs.utimesSync(file, mtimeMs / 1000, mtimeMs / 1000);
  };

  it('picks the newest backup of exactly this slug written since the given moment', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'backups-'));
    fs.mkdirSync(path.join(root, BackupSectionKey.PLUGINS.value));
    vi.spyOn(BackupService as any, 'getBackupsDir').mockReturnValue(root);
    backup('shop-2026-10-04T09-00-00-000Z.tar.gz', 1_000_000);
    backup('shop-2026-10-04T10-00-00-000Z.tar.gz', 3_000_000);
    backup('shop-extra-2026-10-04T11-00-00-000Z.tar.gz', 4_000_000);

    expect(path.basename(PluginInstallRollback.latestBackupSince('shop', 2_000_000) ?? ''))
      .toBe('shop-2026-10-04T10-00-00-000Z.tar.gz');
    expect(PluginInstallRollback.latestBackupSince('shop', 3_500_000)).toBeNull();
  });
});
