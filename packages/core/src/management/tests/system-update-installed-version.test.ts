import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FrameworkRootLocator } from '@core/config/framework-root-locator';
import { SystemUpdateService } from '@core/management/system-update-service';

/**
 * The engine version the update check and the usage report compare against.
 *
 * A starter app is its own project inside the checkout, with its own package.json. Reading THAT as
 * the engine version reported 0.1.0 and offered the release already running as an update.
 */
describe('SystemUpdateService.installedVersion', () => {
  let root: string;

  const writePackage = (dir: string, pkg: Record<string, unknown>) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-installed-version-'));
    writePackage(root, { name: '@fromcode119/framework', version: '0.2.479', workspaces: ['packages/*'] });
    FrameworkRootLocator.forget();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    FrameworkRootLocator.forget();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reads the framework root when the project is the framework itself', () => {
    vi.stubEnv('FROMCODE_PROJECT_ROOT', root);

    expect(SystemUpdateService.installedVersion()).toBe('0.2.479');
  });

  it('reads the framework above a starter project, never the starter\'s own version', () => {
    const starter = path.join(root, 'starters', 'local');
    writePackage(starter, { name: 'my-fromcode-app', version: '0.1.0' });
    vi.stubEnv('FROMCODE_PROJECT_ROOT', starter);

    expect(SystemUpdateService.installedVersion()).toBe('0.2.479');
  });
});
