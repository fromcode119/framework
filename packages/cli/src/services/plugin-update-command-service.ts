import { Command } from 'commander';
import chalk from 'chalk';
import { RunningPlatformApi } from '@cli/services/running-platform-api';
import { PluginMarketplaceInstall } from '@cli/services/plugin-marketplace-install';

/**
 * `plugin install|update|outdated` from a terminal, through the running platform.
 *
 * These used to download the package and overwrite the plugin folder from the CLI's own process, then
 * patch the registry row and ask for an api restart: no verification, no per-site record, no swap of the
 * live plugin, nothing told to the other api processes — and a restart that took the shop down. They now
 * ask the running api, with a platform admin's API token, to do what the admin's button does.
 */
export class PluginUpdateCommandService {
  static register(plugin: Command): void {
    plugin
      .command('install <slug>')
      .description('Install a plugin from the marketplace through the running platform (as the admin does)')
      .option('--version <version>', 'Install a specific version instead of the latest')
      .option('--api <url>', `The platform api (default: $${RunningPlatformApi.URL_ENV}, else this machine)`)
      .action(async (slug: string, options: { version?: string; api?: string }) => {
        await PluginUpdateCommandService.install(slug, options);
      });

    plugin
      .command('update <slug>')
      .description('Update an installed plugin from the marketplace through the running platform (as the admin does)')
      .option('--version <version>', 'Install a specific version instead of the latest')
      .option('--api <url>', `The platform api (default: $${RunningPlatformApi.URL_ENV}, else this machine)`)
      .action(async (slug: string, options: { version?: string; api?: string }) => {
        await PluginUpdateCommandService.install(slug, options);
      });

    plugin
      .command('outdated')
      .description('List installed plugins that have a newer version in the marketplace')
      .option('--api <url>', `The platform api (default: $${RunningPlatformApi.URL_ENV}, else this machine)`)
      .action(async (options: { api?: string }) => {
        await PluginUpdateCommandService.listOutdated(options.api);
      });
  }

  private static async install(slug: string, options: { version?: string; api?: string }): Promise<void> {
    const name = String(slug || '').trim();
    try {
      const installer = new PluginMarketplaceInstall(RunningPlatformApi.connect(options.api));
      console.log(chalk.blue(`\nInstalling ${chalk.bold(name)}${options.version ? ` v${options.version}` : ' (latest)'} from the marketplace...`));
      await installer.run(name, options.version, (line) => console.log(chalk.gray(`  ${line}`)));
      const version = await installer.installedVersion(name);
      console.log(chalk.green(`\n✔ ${chalk.bold(name)}${version ? ` v${version}` : ''} is installed and running on the platform.`));
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red(`\n${name} was not installed:`), error.message);
      process.exit(1);
    }
  }

  private static async listOutdated(apiUrl?: string): Promise<void> {
    try {
      const outdated = await new PluginMarketplaceInstall(RunningPlatformApi.connect(apiUrl)).outdated();
      if (!outdated.length) {
        console.log(chalk.green('\nAll installed plugins are up to date.'));
        process.exit(0);
      }
      console.log(chalk.white(`\n${outdated.length} plugin(s) with a newer marketplace version:`));
      console.log(chalk.gray('--------------------------------------------------'));
      for (const p of outdated) console.log(`${chalk.bold(p.slug)}  ${chalk.gray(p.current)} ${chalk.gray('→')} ${chalk.green(p.latest)}`);
      console.log(chalk.gray('\nRun "fromcode plugin update <slug>" to apply.'));
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('Failed to check for plugin updates:'), error.message);
      process.exit(1);
    }
  }
}
