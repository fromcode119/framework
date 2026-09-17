import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { CliUtils } from '@cli/utils';

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

  /** `my-plugin` → `MyPluginPlugin` — the entry class name for a scaffolded plugin. */
  private static toClassName(slug: string): string {
    const pascal = slug
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    return pascal.endsWith('Plugin') ? pascal : `${pascal}Plugin`;
  }

  private static async writeScaffoldFiles(
    pluginPath: string,
    pluginName: string,
    slug: string,
    category: string,
  ): Promise<void> {
    // Create directory structure. UI sources live under `src/ui` — the path the build actually reads
    // (`PluginPackageLayout.UI_DIR`) and the only tree `import.meta.glob('./**/*.{ts,tsx}')` in the SDK's
    // plugin-ui entry ever sees. `ui/` and `admin/` at the plugin root are build OUTPUT / legacy paths
    // that nothing globs — a component written there never registers.
    await fs.ensureDir(pluginPath);
    await fs.ensureDir(path.join(pluginPath, 'src/ui/pages'));

    // 1. manifest.json
    const manifest = {
      slug,
      name: pluginName,
      version: '1.0.0',
      category,
      capabilities: ['api', 'admin', 'ui', 'database', 'hooks', 'i18n']
    };
    await fs.writeJson(path.join(pluginPath, 'manifest.json'), manifest, { spaces: 2 });

    // 2. index.js — a plugin entry is a CLASS whose statics carry the lifecycle contract.
    const className = PluginScaffoldCommandService.toClassName(slug);
    const indexJs = `
class ${className} {
  static async onInit(context) {
    const { logger } = context;
    logger.info("${pluginName} Plugin Initialized!");

    // Example API route
    context.api.get("/api/${slug}/hello", (req, res) => {
      res.json({ message: "Hello from ${pluginName}!" });
    });

    // Example translation loading from ./i18n/*.json
    context.i18n.registerTranslations();
  }

  static async onEnable(context) {
    context.logger.info("${pluginName} Plugin Enabled!");
  }

  static async onDisable(context) {
    context.logger.info("${pluginName} Plugin Disabled!");
  }
}

module.exports = { ${className} };
`;
    await fs.writeFile(path.join(pluginPath, 'index.js'), indexJs.trim() + '\n');

    // 3. src/ui/pages/dashboard-widget.tsx — an ADMIN component. The plugin-UI entry registers ANY
    // exported class carrying a registration static (see `PluginUiRegistrar`); `static slots` is an
    // array of slot names, read directly off the class — there is no self-registration block to write,
    // the SDK's generated entry does that by gluing `import.meta.glob` to `PluginUiRegistrar.register`.
    const dashboardWidget = `
import type { ReactNode } from 'react';
import { PluginComponent } from '@fromcode119/sdk/react';

/** Admin dashboard widget for ${pluginName}. Registers into this plugin's own admin dashboard slot. */
export class DashboardWidget extends PluginComponent {
  static slots = ['admin.plugin.${slug}.dashboard'];

  render(): ReactNode {
    const t = this.t;
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t('${slug}.dashboard.title', {}, 'Dashboard widget from ${pluginName}')}
        </h3>
      </div>
    );
  }
}
`;
    await fs.writeFile(path.join(pluginPath, 'src/ui/pages/dashboard-widget.tsx'), dashboardWidget.trim() + '\n');

    // 4. src/ui/banner.storefront.css — the plugin's own default styling for the storefront banner
    // below. A separate file (not an inline `style={{...}}` object) so the component stays pure JSX/TSX
    // and the sheet can be reused/overridden like any other stylesheet.
    const bannerCss = `
.fc-${slug}-banner {
  padding: 15px;
  background-color: #e0e0e0;
  text-align: center;
  border-radius: 8px;
  margin: 10px 0;
}
`;
    await fs.writeFile(path.join(pluginPath, 'src/ui/banner.storefront.css'), bannerCss.trim() + '\n');

    // 5. src/ui/banner.storefront.tsx — a STOREFRONT component. Only `*.storefront.{ts,tsx}` files are
    // globbed into the storefront bundle (`PluginUiStorefrontEntry`), so admin-only code never ships to
    // the frontend. `PluginDefaultStyle` delivers the plugin's own default look identically on the
    // server render and in the browser, so the banner never reflows once its stylesheet mounts.
    const banner = `
import type { ReactNode } from 'react';
import { PluginComponent, PluginDefaultStyle } from '@fromcode119/sdk/react';
import bannerCss from '@plugin/src/ui/banner.storefront.css';

/** Storefront banner for ${pluginName}. Registers into the theme's home hero slot. */
export class Banner extends PluginComponent {
  static slots = ['frontend.home.hero'];
  static priority = 10;

  render(): ReactNode {
    const t = this.t;
    return (
      <div className="fc-${slug}-banner">
        <PluginDefaultStyle styleKey="${slug}-banner" css={bannerCss} />
        <div>{t('${slug}.banner.welcome', {}, 'Welcome to ${pluginName}!')}</div>
      </div>
    );
  }
}
`;
    await fs.writeFile(path.join(pluginPath, 'src/ui/banner.storefront.tsx'), banner.trim() + '\n');
  }
}
