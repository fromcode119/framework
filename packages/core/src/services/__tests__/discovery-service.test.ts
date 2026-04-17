import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { DiscoveryService } from '../../plugin/services/discovery-service';

describe('DiscoveryService', () => {
  const projectRoots: string[] = [];

  afterEach(() => {
    delete process.env.FROMCODE_PROJECT_ROOT;

    for (const projectRoot of projectRoots.splice(0)) {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('loads an ESM plugin entry without falling back to require(file://...)', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fromcode-discovery-'));
    projectRoots.push(projectRoot);

    fs.writeFileSync(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ name: '@fromcode119/framework', workspaces: [] }, null, 2),
    );

    const pluginsRoot = path.join(projectRoot, 'plugins');
    const pluginRoot = path.join(pluginsRoot, 'esm-plugin');
    fs.mkdirSync(pluginRoot, { recursive: true });

    fs.writeFileSync(
      path.join(pluginRoot, 'manifest.json'),
      JSON.stringify({
        name: 'ESM Plugin',
        slug: 'esm-plugin',
        version: '0.1.0',
        main: 'index.mjs',
      }, null, 2),
    );

    fs.writeFileSync(
      path.join(pluginRoot, 'index.mjs'),
      [
        'export async function onInit() {}',
        'export default { onInit };',
      ].join('\n'),
    );

    process.env.FROMCODE_PROJECT_ROOT = projectRoot;

    const discoveryService = new DiscoveryService(pluginsRoot, projectRoot);
    const result = await discoveryService.discoverPlugins(new Map());

    expect(result.errored).toHaveLength(0);
    expect(result.discovered).toHaveLength(1);
    expect(result.discovered[0]?.plugin?.manifest?.slug).toBe('esm-plugin');
    expect(typeof result.discovered[0]?.plugin?.onInit).toBe('function');
  });
});