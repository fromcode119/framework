import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { CliUtils } from '@cli/utils';

export class PluginMarketplaceCommandService {
  static register(plugin: Command): void {
    PluginMarketplaceCommandService.registerPack(plugin);
    PluginMarketplaceCommandService.registerSearch(plugin);
    PluginMarketplaceCommandService.registerInstall(plugin);
  }

  private static registerPack(plugin: Command): void {
    plugin
      .command('pack <slug>')
      .description('Pack a plugin into a ZIP for the marketplace')
      .action(async (slug) => {
        try {
          const pluginsDir = CliUtils.getPluginsDir();
          const pluginPath = path.join(pluginsDir, slug);

          if (!fs.existsSync(pluginPath)) {
            console.error(chalk.red(`Plugin directory not found: ${pluginPath}`));
            return;
          }

          const outDir = path.resolve(process.cwd(), 'dist');
          const marketplace = CliUtils.getMarketplaceClient();

          console.log(chalk.blue(`\nPacking ${chalk.bold(slug)}...`));
          const zipPath = await marketplace.pack(pluginPath, outDir);

          console.log(chalk.green(`\nPlugin packed successfully!`));
          console.log(chalk.gray(`Output: ${zipPath}`));

        } catch (error) {
          console.error(chalk.red('Error packing plugin:'), error);
        }
      });
  }

  private static registerSearch(plugin: Command): void {
    plugin
      .command('search [query]')
      .description('Search for plugins in the marketplace')
      .action(async (query) => {
        try {
          const marketplace = CliUtils.getMarketplace();
          console.log(chalk.blue(`\nSearching marketplace...`));

          const plugins = await marketplace.searchPlugins(query || '');

          console.log(chalk.white(`Found ${plugins.length} plugins:`));
          console.log(chalk.gray('--------------------------------------------------'));

          for (const p of plugins) {
            console.log(`${chalk.bold(p.name)} (${chalk.cyan(p.slug)}) v${p.version}`);
            console.log(chalk.gray(`  ${p.description || 'No description'}`));
            console.log(chalk.gray(`  Author: ${p.author || 'unknown'}`));
            console.log('');
          }
        } catch (error: any) {
          console.error(chalk.red('Error searching marketplace:'), error.message);
        }
      });
  }

  private static registerInstall(plugin: Command): void {
    plugin
      .command('install <slug>')
      .description('Install a plugin from the marketplace')
      .action(async (slug) => {
        try {
          const marketplace = CliUtils.getMarketplace();
          console.log(chalk.blue(`\nInstalling plugin: ${chalk.bold(slug)}...`));

          const manifest = await marketplace.downloadAndInstall(slug);

          console.log(chalk.green(`\nPlugin ${chalk.bold(slug)} (v${manifest.version}) installed successfully!`));

        } catch (error: any) {
          console.error(chalk.red('\nInstallation failed:'), error.message);
        }
      });
  }
}
