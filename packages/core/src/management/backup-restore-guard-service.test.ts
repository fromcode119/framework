import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProjectPaths } from '../config/paths';
import { BackupService } from './backup-service';
import { BackupCatalogService } from './backup-catalog-service';
import { BackupRestoreGuardService } from './backup-restore-guard-service';

describe('BackupRestoreGuardService', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    delete process.env.FROMCODE_PROJECT_ROOT;
    (ProjectPaths as any).cachedRoot = null;

    for (const directoryPath of temporaryDirectories) {
      if (fs.existsSync(directoryPath)) {
        fs.rmSync(directoryPath, { recursive: true, force: true });
      }
    }
    temporaryDirectories.length = 0;
  });

  it('creates a safety snapshot and restores a plugin backup into the approved target directory', async () => {
    const frameworkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-restore-'));
    temporaryDirectories.push(frameworkRoot);
    process.env.FROMCODE_PROJECT_ROOT = frameworkRoot;
    fs.writeFileSync(path.join(frameworkRoot, 'package.json'), JSON.stringify({ name: '@fromcode119/framework' }), 'utf8');

    const pluginDirectory = path.join(frameworkRoot, 'plugins', 'demo');
    fs.mkdirSync(pluginDirectory, { recursive: true });
    fs.writeFileSync(path.join(pluginDirectory, 'index.txt'), 'original', 'utf8');

    const backupPath = await BackupService.create('demo', pluginDirectory, 'plugins');
    fs.writeFileSync(path.join(pluginDirectory, 'index.txt'), 'mutated', 'utf8');

    const catalog = new BackupCatalogService();
    const guard = new BackupRestoreGuardService(catalog);
    const backupItem = catalog.resolveByPath(backupPath);
    const preview = await guard.previewRestore({ backupId: backupItem.id, targetKind: 'plugin:demo' });
    const result = await guard.executeRestore({
      backupId: backupItem.id,
      targetKind: 'plugin:demo',
      previewToken: preview.previewToken,
      confirmationText: preview.requiredConfirmationText,
    });

    expect(fs.readFileSync(path.join(pluginDirectory, 'index.txt'), 'utf8')).toBe('original');
    expect(fs.existsSync(result.rollbackSnapshotPath)).toBe(true);
  });

  it('rejects mismatched backup and restore target types', async () => {
    const frameworkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-restore-mismatch-'));
    temporaryDirectories.push(frameworkRoot);
    process.env.FROMCODE_PROJECT_ROOT = frameworkRoot;
    fs.writeFileSync(path.join(frameworkRoot, 'package.json'), JSON.stringify({ name: '@fromcode119/framework' }), 'utf8');

    const systemBackupPath = path.join(frameworkRoot, 'backups', 'system', 'system-2026-04-13.tar.gz');
    const pluginBackupPath = path.join(frameworkRoot, 'backups', 'plugins', 'demo-2026-04-13.tar.gz');
    const themeBackupPath = path.join(frameworkRoot, 'backups', 'themes', 'starter-2026-04-13.tar.gz');
    fs.mkdirSync(path.dirname(systemBackupPath), { recursive: true });
    fs.mkdirSync(path.dirname(pluginBackupPath), { recursive: true });
    fs.mkdirSync(path.dirname(themeBackupPath), { recursive: true });
    fs.writeFileSync(systemBackupPath, 'system', 'utf8');
    fs.writeFileSync(pluginBackupPath, 'plugin', 'utf8');
    fs.writeFileSync(themeBackupPath, 'theme', 'utf8');

    fs.mkdirSync(path.join(frameworkRoot, 'plugins', 'demo'), { recursive: true });
    fs.mkdirSync(path.join(frameworkRoot, 'plugins', 'other'), { recursive: true });
    fs.mkdirSync(path.join(frameworkRoot, 'themes', 'starter'), { recursive: true });

    const catalog = new BackupCatalogService();
    const guard = new BackupRestoreGuardService(catalog);

    await expect(guard.previewRestore({
      backupId: catalog.resolveByPath(systemBackupPath).id,
      targetKind: 'plugin:demo',
    })).rejects.toThrow('Invalid restore target for system backup');

    await expect(guard.previewRestore({
      backupId: catalog.resolveByPath(pluginBackupPath).id,
      targetKind: 'plugin:other',
    })).rejects.toThrow('Invalid restore target for plugin backup');

    await expect(guard.previewRestore({
      backupId: catalog.resolveByPath(themeBackupPath).id,
      targetKind: 'system',
    })).rejects.toThrow('Invalid restore target for theme backup');
  });

  it('rejects unsupported restore targets', async () => {
    const frameworkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-restore-invalid-'));
    temporaryDirectories.push(frameworkRoot);
    process.env.FROMCODE_PROJECT_ROOT = frameworkRoot;
    fs.writeFileSync(path.join(frameworkRoot, 'package.json'), JSON.stringify({ name: '@fromcode119/framework' }), 'utf8');

    const guard = new BackupRestoreGuardService();

    await expect(guard.previewRestore({ backupId: 'missing', targetKind: 'folder:anything' as any })).rejects.toThrow('Invalid backup identifier');
  });

  it('rejects forged restore execution attempts that do not present the issued preview token', async () => {
    const frameworkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-restore-contract-'));
    temporaryDirectories.push(frameworkRoot);
    process.env.FROMCODE_PROJECT_ROOT = frameworkRoot;
    fs.writeFileSync(path.join(frameworkRoot, 'package.json'), JSON.stringify({ name: '@fromcode119/framework' }), 'utf8');

    const pluginDirectory = path.join(frameworkRoot, 'plugins', 'demo');
    fs.mkdirSync(pluginDirectory, { recursive: true });
    fs.writeFileSync(path.join(pluginDirectory, 'index.txt'), 'original', 'utf8');

    const backupPath = await BackupService.create('demo', pluginDirectory, 'plugins');
    const catalog = new BackupCatalogService();
    const guard = new BackupRestoreGuardService(catalog);
    const backupItem = catalog.resolveByPath(backupPath);
    const preview = await guard.previewRestore({ backupId: backupItem.id, targetKind: 'plugin:demo' });

    await expect(guard.executeRestore({
      backupId: backupItem.id,
      targetKind: 'plugin:demo',
      previewToken: 'forged-preview-token',
      confirmationText: preview.requiredConfirmationText,
    })).rejects.toThrow('Restore preview session was not found or has expired.');
  });
});