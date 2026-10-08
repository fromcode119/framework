import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { InstalledDependencies } from '@extension-builder/deps/installed-dependencies';

/**
 * Sources keeps its checkouts and pulls into them, so `node_modules` already exists when a plugin
 * release adds a dependency. A build must still install it — migrate 0.1.4 added `node-html-parser`
 * and every build after failed to resolve it.
 */
describe('InstalledDependencies', () => {
  const directories: string[] = [];
  afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));

  const checkout = (manifest: Record<string, unknown>, withModules = true): string => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'installed-deps-'));
    directories.push(directory);
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(manifest));
    if (withModules) fs.mkdirSync(path.join(directory, 'node_modules'));
    return directory;
  };
  const rewrite = (directory: string, manifest: Record<string, unknown>) => fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(manifest));

  it('installs a directory with no package.json never, and one without node_modules always', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'installed-deps-'));
    directories.push(empty);
    expect(InstalledDependencies.needsInstall(empty, false)).toBe(false);
    expect(InstalledDependencies.needsInstall(checkout({ dependencies: { a: '^1.0.0' } }, false), false)).toBe(true);
  });

  it('installs an existing node_modules that no install recorded — a checkout built before this check', () => {
    expect(InstalledDependencies.needsInstall(checkout({ dependencies: { a: '^1.0.0' } }), false)).toBe(true);
  });

  it('skips once recorded, and installs again when a dependency is added or its range changes', () => {
    const directory = checkout({ dependencies: { 'fast-xml-parser': '^5.0.0' } });
    InstalledDependencies.record(directory, false);
    expect(InstalledDependencies.needsInstall(directory, false)).toBe(false);

    rewrite(directory, { dependencies: { 'fast-xml-parser': '^5.0.0', 'node-html-parser': '^9.0.4' } });
    expect(InstalledDependencies.needsInstall(directory, false)).toBe(true);
    InstalledDependencies.record(directory, false);

    rewrite(directory, { dependencies: { 'fast-xml-parser': '^5.1.0', 'node-html-parser': '^9.0.4' } });
    expect(InstalledDependencies.needsInstall(directory, false)).toBe(true);
  });

  it('ignores host-provided @fromcode119 packages, which the install strips anyway', () => {
    const directory = checkout({ dependencies: { a: '^1.0.0' } });
    InstalledDependencies.record(directory, false);
    rewrite(directory, { dependencies: { a: '^1.0.0', '@fromcode119/sdk': '*' } });
    expect(InstalledDependencies.needsInstall(directory, false)).toBe(false);
  });

  it('a build install satisfies a production one, but not the other way round — and a production install prunes the devDependencies a build installed', () => {
    const built = checkout({ dependencies: { a: '^1.0.0' }, devDependencies: { b: '^2.0.0' } });
    InstalledDependencies.record(built, true);
    expect(InstalledDependencies.needsInstall(built, false)).toBe(false);
    expect(InstalledDependencies.needsInstall(built, true)).toBe(false);

    const production = checkout({ dependencies: { a: '^1.0.0' }, devDependencies: { b: '^2.0.0' } });
    InstalledDependencies.record(production, false);
    expect(InstalledDependencies.needsInstall(production, true)).toBe(true);

    InstalledDependencies.record(built, false);
    expect(InstalledDependencies.needsInstall(built, true)).toBe(true);
  });
});
