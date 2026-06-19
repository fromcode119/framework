import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { CliUtils } from '../utils';

export class PluginScaffoldCommandService {
  static register(plugin: Command): void {
    plugin
      .command('create [name]')
      .description('Create a new plugin scaffold')
      .option('-s, --slug <slug>', 'Plugin slug')
      .option('-c, --category <category>', 'Plugin category')
      .action(async (name, options) => {
        try {
          let pluginName = name;
          if (!pluginName) {
            pluginName = await CliUtils.ask(chalk.blue('Plugin name: '));
          }

          if (!pluginName) {
            console.error(chalk.red('Plugin name is required!'));
            return;
          }

          let slug = options.slug;
          if (!slug) {
            let defaultSlug = pluginName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            slug = await CliUtils.ask(chalk.blue(`Plugin slug [${defaultSlug}]: `));
            if (!slug) slug = defaultSlug;
          }
          let category = options.category;
          if (!category) {
            category = await CliUtils.ask(chalk.blue('Plugin category [general]: '));
            if (!category) category = 'general';
          }
          const pluginsDir = CliUtils.getPluginsDir();
          const pluginPath = path.join(pluginsDir, slug);
          if (fs.existsSync(pluginPath)) {
            console.error(chalk.red(`Plugin directory already exists: ${pluginPath}`));
            return;
          }

          console.log(chalk.green(`\nCreating plugin "${pluginName}" in ${pluginPath}...`));

          await PluginScaffoldCommandService.writeScaffoldFiles(pluginPath, pluginName, slug, category);

          console.log(chalk.green('\nPlugin scaffolded successfully!'));
          console.log(chalk.gray(`Location: ${pluginPath}`));

        } catch (error) {
          console.error(chalk.red('Error creating plugin:'), error);
        }
      });
  }

  private static async writeScaffoldFiles(
    pluginPath: string,
    pluginName: string,
    slug: string,
    category: string,
  ): Promise<void> {
    // Create directory structure
    await fs.ensureDir(pluginPath);
    await fs.ensureDir(path.join(pluginPath, 'admin'));
    await fs.ensureDir(path.join(pluginPath, 'ui'));

    // 1. manifest.json
    const manifest = {
      slug,
      name: pluginName,
      version: '1.0.0',
      category,
      main: 'index.js',
      capabilities: ['api', 'admin', 'ui', 'database', 'hooks', 'i18n']
    };
    await fs.writeJson(path.join(pluginPath, 'manifest.json'), manifest, { spaces: 2 });

    // 2. index.js
    const indexJs = `
module.exports = {
  async onInit(context) {
    const { logger } = context;
    logger.info("${pluginName} Plugin Initialized!");

    // Example API route
    context.api.get("/api/${slug}/hello", (req, res) => {
      res.json({ message: "Hello from ${pluginName}!" });
    });

    // Example translation loading from ./i18n/*.json
    context.i18n.registerTranslations();
  },
  async onEnable(context) {
    context.logger.info("${pluginName} Plugin Enabled!");
  },
  async onDisable(context) {
    context.logger.info("${pluginName} Plugin Disabled!");
  }
};
`;
    await fs.writeFile(path.join(pluginPath, 'index.js'), indexJs.trim() + '\n');

    // 3. admin/DashboardWidget.tsx
    const dashboardWidget = `
import React from 'react';

const DashboardWidget = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '8px', margin: '10px 0' }}>
      <h3>Dashboard Widget from ${pluginName}</h3>
    </div>
  );
};

export default DashboardWidget;
`;
    await fs.writeFile(path.join(pluginPath, 'admin/DashboardWidget.tsx'), dashboardWidget.trim() + '\n');

    // 4. ui/banner.tsx
    const banner = `
import React from 'react';

const Banner = () => {
  return (
    <div style={{ padding: '15px', backgroundColor: '#e0e0e0', textAlign: 'center', borderRadius: '8px', margin: '10px 0' }}>
      <div key="msg">Welcome to ${pluginName} Banner!</div>
    </div>
  );
};

export default Banner;
`;
    await fs.writeFile(path.join(pluginPath, 'ui/banner.tsx'), banner.trim() + '\n');

    // 5. ui/index.ts
    const uiIndex = `
import Banner from './banner';

export const slots = {
  'frontend.home.hero': {
    component: Banner,
    priority: 10
  }
};

export const init = () => {
  console.log('[${slug}] UI Initialized');
};

// --- Self-Registration ---
if (typeof window !== 'undefined' && (window as any).Fromcode) {
  const Fromcode = (window as any).Fromcode;

  // Register slots
  Object.entries(slots).forEach(([slotName, config]: [string, any]) => {
    Fromcode.registerSlotComponent(slotName, {
      ...config,
      pluginSlug: '${slug}'
    });
  });

  // Run initialization
  init();
}
`;
    await fs.writeFile(path.join(pluginPath, 'ui/index.ts'), uiIndex.trim() + '\n');
  }
}
