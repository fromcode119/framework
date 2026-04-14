import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProjectPaths } from '../config/paths';
import { BackupCatalogService } from './backup-catalog-service';

describe('BackupCatalogService', () => {
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

  it('groups backups by category and resolves stable ids back to files', async () => {
    const frameworkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-catalog-'));
    temporaryDirectories.push(frameworkRoot);
    process.env.FROMCODE_PROJECT_ROOT = frameworkRoot;
    fs.writeFileSync(path.join(frameworkRoot, 'package.json'), JSON.stringify({ name: '@fromcode119/framework' }), 'utf8');

    const backupsRoot = path.join(frameworkRoot, 'backups');
    fs.mkdirSync(path.join(backupsRoot, 'system'), { recursive: true });
    fs.mkdirSync(path.join(backupsRoot, 'plugins'), { recursive: true });
    fs.mkdirSync(path.join(backupsRoot, 'themes'), { recursive: true });
    fs.mkdirSync(path.join(backupsRoot, 'database'), { recursive: true });
    fs.writeFileSync(path.join(backupsRoot, 'system', 'system-2026-04-13.tar.gz'), 'system', 'utf8');
    fs.writeFileSync(path.join(backupsRoot, 'plugins', 'demo-2026-04-13.tar.gz'), 'plugin', 'utf8');
    fs.writeFileSync(path.join(backupsRoot, 'themes', 'ocean-2026-04-13.tar.gz'), 'theme', 'utf8');
    fs.writeFileSync(path.join(backupsRoot, 'database', 'db-dump-2026-04-13.sql'), 'database', 'utf8');

    const service = new BackupCatalogService();
    const groups = await service.listBackupGroups();

    expect(groups.map((group) => group.key)).toEqual(['system', 'plugins', 'themes', 'database']);
    expect(groups[1].items[0].scopeSlug).toBe('demo');
    expect(groups[2].items[0].scopeSlug).toBe('ocean');

    const resolved = await service.resolveById(groups[1].items[0].id);
    expect(resolved.filename).toBe('demo-2026-04-13.tar.gz');
    expect(resolved.absolutePath).toBe(path.join(backupsRoot, 'plugins', 'demo-2026-04-13.tar.gz'));
  });
});