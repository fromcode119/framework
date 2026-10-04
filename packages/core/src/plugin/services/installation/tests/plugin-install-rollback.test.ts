import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tar from 'tar';
import { PluginInstallRollback } from '@core/plugin/services/installation/plugin-install-rollback';

describe('PluginInstallRollback', () => {
  const roots: string[] = [];
  const logger = { warn: vi.fn(), error: vi.fn() } as any;

  const tempDir = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rollback-test-'));
    roots.push(dir);
    return dir;
  };

  const writePlugin = (pluginsRoot: string, version: string): void => {
    fs.mkdirSync(path.join(pluginsRoot, 'alpha'), { recursive: true });
    fs.writeFileSync(path.join(pluginsRoot, 'alpha', 'manifest.json'), JSON.stringify({ slug: 'alpha', version }));
  };

  const versionOnDisk = (pluginsRoot: string): string =>
    JSON.parse(fs.readFileSync(path.join(pluginsRoot, 'alpha', 'manifest.json'), 'utf8')).version;

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of roots.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('puts the replaced files back when the migration step fails, and rethrows', async () => {
    const pluginsRoot = tempDir();
    writePlugin(pluginsRoot, '1.0.0');
    const backup = path.join(tempDir(), 'alpha-2026-10-04T10-00-00-000Z.tar.gz');
    await tar.create({ gzip: true, file: backup, cwd: pluginsRoot }, ['alpha']);
    writePlugin(pluginsRoot, '1.0.1');
    vi.spyOn(PluginInstallRollback, 'latestBackupSince').mockReturnValue(backup);

    await expect(new PluginInstallRollback(pluginsRoot, logger).runOrRestore('alpha', 0, async () => {
      throw new Error('migration failed');
    })).rejects.toThrow('migration failed');

    expect(versionOnDisk(pluginsRoot)).toBe('1.0.0');
  });

  it('removes a plugin that was not installed before when its migration step fails', async () => {
    const pluginsRoot = tempDir();
    writePlugin(pluginsRoot, '1.0.0');
    vi.spyOn(PluginInstallRollback, 'latestBackupSince').mockReturnValue(null);

    await expect(new PluginInstallRollback(pluginsRoot, logger).runOrRestore('alpha', 0, async () => {
      throw new Error('migration failed');
    })).rejects.toThrow('migration failed');

    expect(fs.existsSync(path.join(pluginsRoot, 'alpha'))).toBe(false);
  });

  it('leaves the new files alone when the step succeeds', async () => {
    const pluginsRoot = tempDir();
    writePlugin(pluginsRoot, '1.0.1');
    const latest = vi.spyOn(PluginInstallRollback, 'latestBackupSince');

    await new PluginInstallRollback(pluginsRoot, logger).runOrRestore('alpha', 0, async () => undefined);

    expect(versionOnDisk(pluginsRoot)).toBe('1.0.1');
    expect(latest).not.toHaveBeenCalled();
  });
});
