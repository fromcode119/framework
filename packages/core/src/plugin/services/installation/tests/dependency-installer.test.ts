import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DependencyInstaller } from '@core/plugin/services/installation/dependency-installer';

describe('DependencyInstaller', () => {
  it('always ignores lifecycle scripts — installing must never execute the package', () => {
    expect(DependencyInstaller.INSTALL_FLAGS).toContain('--ignore-scripts');
  });

  it('always skips peer resolution — one devDep peer graph crashed arborist and failed the plugin', () => {
    expect(DependencyInstaller.INSTALL_FLAGS).toContain('--legacy-peer-deps');
  });

  it('adds --omit=dev only when asked', () => {
    expect(DependencyInstaller.argsFor({ omitDev: true })).toContain('--omit=dev');
    expect(DependencyInstaller.argsFor({ omitDev: false })).not.toContain('--omit=dev');
  });

  it('uses ci only when a lockfile is present, install otherwise', () => {
    expect(DependencyInstaller.argsFor({ omitDev: true, hasLockfile: true })[0]).toBe('ci');
    expect(DependencyInstaller.argsFor({ omitDev: true, hasLockfile: false })[0]).toBe('install');
  });
});

describe('DependencyInstaller.install', () => {
  const packageDir = (dependencies: Record<string, string>) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-installer-'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'probe', version: '1.0.0', dependencies }));
    return dir;
  };

  // It runs inside the api: while npm works, the api must go on answering every site.
  it('leaves the event loop running while npm works', async () => {
    const dir = packageDir({});
    let ticks = 0;
    const timer = setInterval(() => { ticks += 1; }, 10);
    try {
      await DependencyInstaller.install(dir, { omitDev: true });
    } finally {
      clearInterval(timer);
      fs.rmSync(dir, { recursive: true, force: true });
    }
    expect(ticks).toBeGreaterThan(0);
  }, 60_000);

  it('rejects naming the directory when npm fails', async () => {
    const dir = packageDir({});
    fs.writeFileSync(path.join(dir, 'package.json'), '{ not json');
    try {
      await expect(DependencyInstaller.install(dir, { omitDev: true })).rejects.toThrow(`Dependency install failed for ${dir}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
