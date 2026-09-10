import { describe, expect, it } from 'vitest';
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
