/** Plugin scaffold service — creates new plugin boilerplate on disk. Extracted from PluginManager (ARC-007). */

import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '@fromcode119/sdk';
import { ProjectPaths } from '../../config/paths';
import type { ScaffoldPluginInput, ScaffoldPluginResult } from './plugin-scaffold-service.interfaces';

export class PluginScaffoldService {
  constructor(
    private readonly logger: Logger,
    private readonly hasPlugin: (slug: string) => boolean,
    private readonly discoverPlugins: () => Promise<void>,
    private readonly enable: (slug: string) => Promise<void>,
  ) {}

  async scaffoldPlugin(input: ScaffoldPluginInput): Promise<ScaffoldPluginResult> {
    const slug = String(input.slug || '').trim().toLowerCase();
    const name = String(input.name || '').trim();
    const description = String(input.description || '').trim();
    const version = String(input.version || '1.0.0').trim() || '1.0.0';
    const activate = input.activate !== false;

    if (!slug || !name) throw new Error('Plugin slug and name are required');

    const pluginsDir = ProjectPaths.getPluginsDir();
    const pluginPath = path.join(pluginsDir, slug);

    if (this.hasPlugin(slug)) throw new Error(`Plugin "${slug}" already exists.`);
    if (fs.existsSync(pluginPath)) throw new Error(`Plugin path already exists: ${pluginPath}`);

    fs.mkdirSync(path.join(pluginPath, 'ui'), { recursive: true });

    const manifest = {
      slug, name, version, description,
      main: 'index.js',
      capabilities: ['api', 'hooks', 'ui'],
      ui: { entry: 'index.js' },
    };

    const pluginMain = [
      "'use strict';", '',
      'module.exports = {',
      '  async onInit(context) {',
      `    context.logger.info('${name} initialized.');`,
      '  },',
      '  async onEnable(context) {',
      `    context.logger.info('${name} enabled.');`,
      '  },',
      '  async onDisable(context) {',
      `    context.logger.info('${name} disabled.');`,
      '  },',
      '};', '',
    ].join('\n');

    const uiEntry = [
      'export const init = () => {',
      `  console.info('[${slug}] UI initialized.');`,
      '};', '',
      'if (typeof window !== "undefined" && (window).Fromcode) {',
      '  init();',
      '}', '',
    ].join('\n');

    fs.writeFileSync(path.join(pluginPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(pluginPath, 'index.js'), pluginMain, 'utf8');
    fs.writeFileSync(path.join(pluginPath, 'ui', 'index.js'), uiEntry, 'utf8');

    await this.discoverPlugins();

    let activated = false;
    let activationError: string | null = null;
    if (activate) {
      try {
        await this.enable(slug);
        activated = true;
      } catch (error: any) {
        activationError = String(error?.message || 'Activation failed');
      }
    }

    this.logger.info(`Plugin "${slug}" scaffolded at ${pluginPath}`);
    return { slug, name, path: pluginPath, activated, activationError, manifest };
  }
}
