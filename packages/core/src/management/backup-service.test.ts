import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProjectPaths } from '../config/paths';
import { BackupService } from './backup-service';

describe('BackupService', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DATABASE_URL;
    delete process.env.DB_DIALECT;
    delete process.env.FROMCODE_PROJECT_ROOT;
    (ProjectPaths as any).cachedRoot = null;

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

    const result = await BackupService.createSystemBackupBundle({ sections: ['database'] });

    expect(result).toEqual({
      backupPath: databaseBackupPath,
      requestedSections: ['database'],
      includedSections: ['database'],
      warnings: [],
    });
  });

  it('reports an explicit error when a database-only backup is unavailable', async () => {
    vi.spyOn(BackupService, 'backupDatabase').mockResolvedValue(null);

    await expect(BackupService.createSystemBackupBundle({ sections: ['database'] })).rejects.toThrow(
      'Database backup was requested, but no database snapshot is available in this environment.',
    );
  });

  it('creates a sqlite database copy when DATABASE_URL uses a relative file: URL', async () => {
    const frameworkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-service-framework-'));
    temporaryDirectories.push(frameworkRoot);
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
});