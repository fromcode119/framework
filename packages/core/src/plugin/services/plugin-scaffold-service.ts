/** Plugin scaffold service — creates new plugin boilerplate on disk. Extracted from PluginManager (ARC-007). */

import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '@core/logging';
import { ProjectPaths } from '@core/config/paths';
import type { IScaffoldPluginInput } from '@core/plugin/services/interfaces/scaffold-plugin-input.interface';
import type { IScaffoldPluginResult } from '@core/plugin/services/interfaces/scaffold-plugin-result.interface';

export class PluginScaffoldService {
  constructor(
    private readonly logger: Logger,
    private readonly hasPlugin: (slug: string) => boolean,
    private readonly discoverPlugins: () => Promise<void>,
    private readonly enable: (slug: string) => Promise<void>,
  ) {}

  /** `my-plugin` → `MyPluginPlugin` — the entry class name for a scaffolded plugin. */
  private static toClassName(slug: string): string {
    const pascal = slug
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    return pascal.endsWith('Plugin') ? pascal : `${pascal}Plugin`;
  }

  async scaffoldPlugin(input: IScaffoldPluginInput): Promise<IScaffoldPluginResult> {
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

    fs.mkdirSync(path.join(pluginPath, 'src', 'ui'), { recursive: true });

    const manifest = {
      slug, name, version, description,
      capabilities: ['api', 'hooks', 'ui'],
      ui: { entry: 'index.js' },
    };

    // A plugin entry is a CLASS whose statics carry the lifecycle contract.
    const className = PluginScaffoldService.toClassName(slug);
    const pluginMain = [
      "'use strict';", '',
      `class ${className} {`,
      '  static async onInit(context) {',
      `    context.logger.info('${name} initialized.');`,
      '  }', '',
      '  static async onEnable(context) {',
      `    context.logger.info('${name} enabled.');`,
      '  }', '',
      '  static async onDisable(context) {',
      `    context.logger.info('${name} disabled.');`,
      '  }',
      '}', '',
      `module.exports = { ${className} };`, '',
    ].join('\n');

    const uiEntry = [
      'export const init = () => {',
      `  console.info('[${slug}] UI initialized.');`,
      '};', '',
      'if (typeof window !== "undefined" && window.__fromcodeRuntimeModules && window.__fromcodeRuntimeModules["@fromcode119/react"]) {',
      '  init();',
      '}', '',
    ].join('\n');

    fs.writeFileSync(path.join(pluginPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(pluginPath, 'index.js'), pluginMain, 'utf8');
    fs.writeFileSync(path.join(pluginPath, 'src', 'ui', 'index.js'), uiEntry, 'utf8');

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
