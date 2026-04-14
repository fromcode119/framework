import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as tar from 'tar';
import { ProjectPaths } from '../config/paths';
import { SiteTransferBundleService } from './site-transfer-bundle-service';

describe('SiteTransferBundleService', () => {
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

  it('writes bundle artifacts to the framework-root site-transfer directory and excludes secrets by default', async () => {
    const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'site-transfer-repo-'));
    const frameworkRoot = path.join(repositoryRoot, 'framework', 'Source');
    temporaryDirectories.push(repositoryRoot);

    process.env.FROMCODE_PROJECT_ROOT = frameworkRoot;

    fs.mkdirSync(frameworkRoot, { recursive: true });
    fs.mkdirSync(path.join(frameworkRoot, 'artifacts'), { recursive: true });
    fs.writeFileSync(path.join(frameworkRoot, 'package.json'), JSON.stringify({ name: '@fromcode119/framework', version: '2.5.0' }), 'utf8');
    fs.writeFileSync(path.join(frameworkRoot, '.env.example'), 'JWT_SECRET=\nAPI_URL=\n', 'utf8');
    fs.writeFileSync(path.join(frameworkRoot, 'index.txt'), 'framework', 'utf8');
    fs.mkdirSync(path.join(frameworkRoot, 'secrets'), { recursive: true });
    fs.writeFileSync(path.join(frameworkRoot, 'secrets', 'token.txt'), 'secret', 'utf8');

    const service = new SiteTransferBundleService({
      find: async (table: any) => {
        if (String(table?.[Symbol.for('drizzle:Name')] || table?.['_.name'] || '') === '_system_themes') {
          return [{ slug: 'starter', state: 'active' }];
        }
        return [{ slug: 'demo', version: '1.0.0', state: 'active' }];
      },
      asc: (value: unknown) => value,
    } as any);

    const result = await service.createBundle({ label: 'demo-transfer' });
    const tarEntries: string[] = [];
    await tar.list({
      file: result.snapshotPath,
      onentry: (entry) => tarEntries.push(String(entry.path || '')),
    });

    expect(result.bundleDirectory.startsWith(path.join(frameworkRoot, 'artifacts', 'site-transfer'))).toBe(true);
    expect(fs.existsSync(result.manifestPath)).toBe(true);
    expect(fs.existsSync(path.join(result.bundleDirectory, 'required-environment-keys.txt'))).toBe(true);
    expect(tarEntries.some((entry) => entry.startsWith('secrets/'))).toBe(false);
  });

  it('keeps public assets while excluding uploads when include-public is enabled without include-uploads', async () => {
    const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'site-transfer-public-'));
    const frameworkRoot = path.join(repositoryRoot, 'framework', 'Source');
    temporaryDirectories.push(repositoryRoot);

    process.env.FROMCODE_PROJECT_ROOT = frameworkRoot;

    fs.mkdirSync(path.join(frameworkRoot, 'public', 'uploads'), { recursive: true });
    fs.mkdirSync(path.join(frameworkRoot, 'artifacts'), { recursive: true });
    fs.writeFileSync(path.join(frameworkRoot, 'package.json'), JSON.stringify({ name: '@fromcode119/framework', version: '2.5.0' }), 'utf8');
    fs.writeFileSync(path.join(frameworkRoot, 'public', 'robots.txt'), 'allow', 'utf8');
    fs.writeFileSync(path.join(frameworkRoot, 'public', 'uploads', 'image.jpg'), 'binary', 'utf8');

    const service = new SiteTransferBundleService({
      find: async () => [],
      asc: (value: unknown) => value,
    } as any);

    const result = await service.createBundle({
      label: 'public-no-uploads',
      includePublic: true,
      includeUploads: false,
    });
    const tarEntries: string[] = [];
    await tar.list({
      file: result.snapshotPath,
      onentry: (entry) => tarEntries.push(String(entry.path || '')),
    });

    expect(tarEntries).toContain('public/robots.txt');
    expect(tarEntries.some((entry) => entry.startsWith('public/uploads/'))).toBe(false);
  });
});