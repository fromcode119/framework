import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { afterAll, describe, expect, it } from 'vitest';
import { PluginImportBoundary } from '@core/plugin/plugin-import-boundary';

/**
 * A plugin reaches the framework only through the SDK — enforced when the code RUNS, not only when it
 * is built, because an upload or a hand-edited bundle never went through the build.
 */
describe('what a plugin file may import', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-boundary-'));
  const pluginsRoot = path.join(project, 'plugins');
  const pkg = (name: string) => {
    const dir = path.join(project, 'packages', name);
    fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: `@fromcode119/${name}`, main: 'dist/index.js' }));
    fs.writeFileSync(path.join(dir, 'dist', 'index.js'), name === 'sdk' ? `module.exports = { core: require('@fromcode119/core') };` : `module.exports = { name: '${name}' };`);
    fs.mkdirSync(path.join(project, 'node_modules', '@fromcode119'), { recursive: true });
    fs.symlinkSync(dir, path.join(project, 'node_modules', '@fromcode119', name));
  };
  pkg('core'); pkg('sdk');
  fs.mkdirSync(path.join(pluginsRoot, 'tenants', 'acme', 'x'), { recursive: true });
  const pluginFile = path.join(pluginsRoot, 'tenants', 'acme', 'x', 'index.js');
  fs.writeFileSync(pluginFile, '');
  const outsideFile = path.join(project, 'elsewhere.js');
  fs.writeFileSync(outsideFile, '');
  PluginImportBoundary.guard(pluginsRoot, project);
  afterAll(() => fs.rmSync(project, { recursive: true, force: true }));

  it('refuses the framework\'s internals from a plugin, by name and by path', () => {
    const fromPlugin = createRequire(pluginFile);
    expect(() => fromPlugin('@fromcode119/core')).toThrow(/Security Violation/);
    expect(() => fromPlugin(path.join(project, 'packages', 'core', 'dist', 'index.js'))).toThrow(/Security Violation/);
  });

  it('allows the SDK — which itself loads the framework as always — and ordinary modules', () => {
    const fromPlugin = createRequire(pluginFile);
    expect(fromPlugin('@fromcode119/sdk').core.name).toBe('core');
    expect(typeof fromPlugin('path').join).toBe('function');
  });

  it('holds nothing outside a plugin root to it', () => {
    expect(createRequire(outsideFile)('@fromcode119/core').name).toBe('core');
  });
});
