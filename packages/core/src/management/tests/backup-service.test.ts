import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as tar from 'tar';
import { ProjectPaths } from '@core/config/paths';
import { BackupService } from '@core/management/backup-service';
import { BackupSectionKey } from '@core/management/enums/backup-section-key.enum';
import { FrameworkRootLocator } from '@core/config/framework-root-locator';

describe('BackupService', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DATABASE_URL;
    delete process.env.DB_DIALECT;
    delete process.env.FROMCODE_PROJECT_ROOT;
    FrameworkRootLocator.forget();

    for (const directoryPath of temporaryDirectories) {
      if (fs.existsSync(directoryPath)) {
        fs.rmSync(directoryPath, { recursive: true, force: true });
      }
    }

    temporaryDirectories.length = 0;
  });

  it('creates a standalone database backup when database is the only selected section', async () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-service-db-only-'));
    temporaryDirectories.push(tempDirectory);
    const databaseBackupPath = path.join(tempDirectory, 'db-dump-2026-04-13.sql');
    fs.writeFileSync(databaseBackupPath, 'database', 'utf8');

    vi.spyOn(BackupService, 'backupDatabase').mockResolvedValue(databaseBackupPath);

    const result = await BackupService.createSystemBackupBundle({ sections: [BackupSectionKey.DATABASE] });

    expect(result).toEqual({
      backupPath: databaseBackupPath,
      requestedSections: [BackupSectionKey.DATABASE],
      includedSections: [BackupSectionKey.DATABASE],
      warnings: [],
    });
  });

  it('reports an explicit error when a database-only backup is unavailable', async () => {
    vi.spyOn(BackupService, 'backupDatabase').mockResolvedValue(null);

    await expect(BackupService.createSystemBackupBundle({ sections: [BackupSectionKey.DATABASE] })).rejects.toThrow(
      'Database backup was requested, but no database snapshot is available in this environment.',
    );
  });

  it('creates a sqlite database copy when DATABASE_URL uses a relative file: URL', async () => {
    // The fake framework root is nested TWO levels inside the sandbox, because the relative URL under
    // test resolves two levels above it. A root placed directly in the temp dir resolved `../../data`
    // to whatever sits two levels above the system temp dir — harmless under macOS's deep
    // `/var/folders/...` path, and `/data` on Linux, where the test died with EACCES the first time it
    // ran anywhere but a developer's laptop.
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-service-'));
    temporaryDirectories.push(sandbox);
    const frameworkRoot = path.join(sandbox, 'platform', 'framework');
    fs.mkdirSync(frameworkRoot, { recursive: true });
    process.env.FROMCODE_PROJECT_ROOT = frameworkRoot;
    fs.writeFileSync(path.join(frameworkRoot, 'package.json'), JSON.stringify({ name: '@fromcode119/framework' }), 'utf8');

    const databaseDirectory = path.resolve(frameworkRoot, '../../data');
    fs.mkdirSync(databaseDirectory, { recursive: true });
    const databasePath = path.join(databaseDirectory, 'app.db');
    fs.writeFileSync(databasePath, 'sqlite-data', 'utf8');
    process.env.DATABASE_URL = 'file:../../data/app.db';

    const backupPath = await BackupService.backupDatabase();

    expect(backupPath).toBeTruthy();
    expect(backupPath?.endsWith('.db')).toBe(true);
    expect(backupPath && fs.existsSync(backupPath)).toBe(true);
    expect(backupPath ? fs.readFileSync(backupPath, 'utf8') : '').toBe('sqlite-data');
  });

  // Root reads every directory whatever its mode, so there is nothing to leave out.
  it.skipIf(process.getuid?.() === 0)('leaves out a folder the server cannot read, names it, and still writes the archive', async () => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-service-unreadable-'));
    temporaryDirectories.push(sandbox);
    process.env.FROMCODE_PROJECT_ROOT = sandbox;
    fs.writeFileSync(path.join(sandbox, 'package.json'), JSON.stringify({ name: '@fromcode119/framework' }), 'utf8');
    fs.mkdirSync(path.join(sandbox, 'plugins', 'shop'), { recursive: true });
    fs.writeFileSync(path.join(sandbox, 'plugins', 'shop', 'index.js'), 'shop', 'utf8');
    const locked = path.join(sandbox, 'plugins', 'analytics');
    fs.mkdirSync(locked, { recursive: true });
    fs.writeFileSync(path.join(locked, 'index.js'), 'analytics', 'utf8');
    fs.chmodSync(locked, 0o000);

    try {
      const result = await BackupService.createSystemBackupBundle({ sections: [BackupSectionKey.PLUGINS] });

      expect(result.warnings).toEqual(['Left out of the backup because the server cannot read them: plugins/analytics.']);
      const archived: string[] = [];
      await tar.list({ file: result.backupPath, onentry: (entry) => { archived.push(entry.path); } });
      expect(archived).toContain('plugins/shop/index.js');
      expect(archived.some((entry) => entry.startsWith('plugins/analytics'))).toBe(false);
    } finally {
      fs.chmodSync(locked, 0o755);
    }
  });

  it('archives the database dump from the backups folder, without writing into the project root', async () => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-service-db-entry-'));
    temporaryDirectories.push(sandbox);
    process.env.FROMCODE_PROJECT_ROOT = sandbox;
    fs.writeFileSync(path.join(sandbox, 'package.json'), JSON.stringify({ name: '@fromcode119/framework' }), 'utf8');
    const dumpPath = path.join(BackupService.getBackupsDirectory('database'), 'db-dump-2026-11-20.sql');
    fs.mkdirSync(path.dirname(dumpPath), { recursive: true });
    fs.writeFileSync(dumpPath, 'dump', 'utf8');
    vi.spyOn(BackupService, 'backupDatabase').mockResolvedValue(dumpPath);
    const copies = vi.spyOn(fs, 'copyFileSync');

    const result = await BackupService.createSystemBackupBundle({ sections: [BackupSectionKey.CORE, BackupSectionKey.DATABASE] });

    expect(copies).not.toHaveBeenCalled();
    expect(result.includedSections).toContain(BackupSectionKey.DATABASE);
    expect(result.warnings).toEqual([]);
    const archived: string[] = [];
    await tar.list({ file: result.backupPath, onentry: (entry) => { archived.push(entry.path); } });
    expect(archived).toContain(path.relative(sandbox, dumpPath).split(path.sep).join('/'));
    expect(fs.existsSync(dumpPath)).toBe(true);
  });
});
