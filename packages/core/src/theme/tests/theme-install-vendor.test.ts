import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackupService } from '@core/management/backup-service';
import { ThemeInstallerService } from '@core/theme/theme-installer-service';
import { AppearanceInstallerService } from '@core/appearance/appearance-installer-service';

/** A theme or appearance from another vendor never installs over an installed one with the same slug. */

const DIRS: string[] = [];
const logger: any = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  DIRS.push(dir);
  return dir;
}

function packageDir(file: string, manifest: Record<string, unknown>): string {
  const dir = tempDir('fc-pkg-');
  fs.writeFileSync(path.join(dir, file), JSON.stringify(manifest));
  fs.mkdirSync(path.join(dir, 'ui'));
  fs.writeFileSync(path.join(dir, 'ui', 'bundle.js'), '// incoming\n');
  return dir;
}

function installed(root: string, slug: string, file: string, manifest: Record<string, unknown>): string {
  const dir = path.join(root, slug);
  fs.mkdirSync(path.join(dir, 'ui'), { recursive: true });
  fs.writeFileSync(path.join(dir, file), JSON.stringify(manifest));
  fs.writeFileSync(path.join(dir, 'ui', 'bundle.js'), '// installed\n');
  return dir;
}

function themeInstaller(themesRoot: string): ThemeInstallerService {
  return new ThemeInstallerService(logger, themesRoot, {} as any, async () => ({}) as any, null, async () => undefined, (slug) => path.join(themesRoot, slug));
}

afterEach(() => {
  vi.restoreAllMocks();
  while (DIRS.length) fs.rmSync(DIRS.pop() as string, { recursive: true, force: true });
});

describe('theme and appearance installs check the vendor', () => {
  it('refuses a theme from another vendor and leaves the installed one', async () => {
    const root = tempDir('fc-themes-');
    const target = installed(root, 'finestra', 'theme.json', { slug: 'finestra', namespace: 'org.fromcode', name: 'F', version: '0.1.0', layouts: [] });
    const pkg = packageDir('theme.json', { slug: 'finestra', namespace: 'com.other', name: 'F', version: '9.0.0', layouts: [] });

    await expect(themeInstaller(root).installFromDirectory(pkg, new Map())).rejects.toThrow(/org\.fromcode/);
    expect(fs.readFileSync(path.join(target, 'ui', 'bundle.js'), 'utf8')).toBe('// installed\n');
  });

  it('updates a theme from the same vendor', async () => {
    const root = tempDir('fc-themes-');
    const target = installed(root, 'finestra', 'theme.json', { slug: 'finestra', namespace: 'org.fromcode', name: 'F', version: '0.1.0', layouts: [] });
    const pkg = packageDir('theme.json', { slug: 'finestra', namespace: 'org.fromcode', name: 'F', version: '0.1.1', layouts: [] });
    vi.spyOn(BackupService, 'create').mockResolvedValue(undefined as never);

    await themeInstaller(root).installFromDirectory(pkg, new Map());
    expect(fs.readFileSync(path.join(target, 'ui', 'bundle.js'), 'utf8')).toBe('// incoming\n');
  });

  it('refuses an appearance from another vendor and leaves the installed one', () => {
    const root = tempDir('fc-appearances-');
    const target = installed(root, 'hub', 'appearance.json', { slug: 'hub', namespace: 'org.fromcode' });
    const pkg = packageDir('appearance.json', { slug: 'hub', namespace: 'com.other' });
    const installer = new AppearanceInstallerService(logger, root, {} as any);

    expect(() => installer.installFromDirectory(pkg)).toThrow(/appearance "hub".*org\.fromcode/);
    expect(fs.readFileSync(path.join(target, 'ui', 'bundle.js'), 'utf8')).toBe('// installed\n');
  });
});
