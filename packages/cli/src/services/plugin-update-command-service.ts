import { Command } from 'commander';
import chalk from 'chalk';
import semver from 'semver';
import { SystemConstants } from '@fromcode119/core';
import { CliUtils } from '../utils';

/**
 * Terminal download + update for installed plugins, straight from the marketplace registry.
 * `outdated` compares each installed plugin (the `_system_plugins` registry) against the catalog;
 * `update <slug>` downloads the latest package (with its dependencies) and overwrites the plugin
 * on disk, then reconciles the registry row. Restart the API afterwards so the new code loads.
 */
export class PluginUpdateCommandService {
  private static readonly TABLE = SystemConstants.TABLE.PLUGINS;

  static register(plugin: Command): void {
    plugin
      .command('outdated')
      .description('List installed plugins that have a newer version in the marketplace')
      .action(async () => {
        await PluginUpdateCommandService.listOutdated();
      });

    plugin
      .command('update <slug>')
      .description('Download and install the latest version of an installed plugin')
      .option('--version <version>', 'Install a specific version instead of the latest')
      .action(async (slug: string, options: { version?: string }) => {
        await PluginUpdateCommandService.update(slug, options.version);
      });
  }

  /** True when `latest` is a strictly greater semver than `current` (lenient on non-semver strings). */
  private static isNewer(latest: string | undefined, current: string): boolean {
    if (!latest) return false;
    const a = semver.coerce(latest);
    const b = semver.coerce(current);
    if (a && b) return semver.gt(a, b);
    return latest !== current;
  }

  private static async listOutdated(): Promise<void> {
    const db = await CliUtils.getDatabase();
    try {
      const installed = await db.find(PluginUpdateCommandService.TABLE, { orderBy: { slug: 'asc' }, limit: 1000 });
      const catalog = await CliUtils.getMarketplace().fetchCatalog();
      const latestBySlug = new Map(catalog.map((p: any) => [String(p.slug), String(p.version)]));

      if (!catalog.length) {
        console.log(chalk.yellow('\nMarketplace catalog is empty or unreachable (check MARKETPLACE_URL).'));
        process.exit(0);
      }

      const outdated = installed
        .map((row: any) => ({ slug: String(row.slug), current: String(row.version || '0.0.0'), latest: latestBySlug.get(String(row.slug)) }))
        .filter((p) => PluginUpdateCommandService.isNewer(p.latest, p.current));

      if (!outdated.length) {
        console.log(chalk.green('\nAll installed plugins are up to date.'));
        process.exit(0);
      }

      console.log(chalk.white(`\n${outdated.length} plugin(s) with a different marketplace version:`));
      console.log(chalk.gray('--------------------------------------------------'));
      for (const p of outdated) {
        console.log(`${chalk.bold(p.slug)}  ${chalk.gray(p.current)} ${chalk.gray('→')} ${chalk.green(p.latest)}`);
      }
      console.log(chalk.gray('\nRun "fromcode plugin update <slug>" to apply.'));
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('Failed to check for plugin updates:'), error.message);
      process.exit(1);
    }
  }

  private static async update(slug: string, version?: string): Promise<void> {
    const normalizedSlug = String(slug || '').trim();
    const db = await CliUtils.getDatabase();
    try {
      const existing = await db.findOne(PluginUpdateCommandService.TABLE, { slug: normalizedSlug });
      if (!existing) {
        console.error(chalk.red(`Plugin "${normalizedSlug}" is not installed. Use "fromcode plugin install ${normalizedSlug}".`));
        process.exit(1);
      }

      console.log(chalk.blue(`\nDownloading ${chalk.bold(normalizedSlug)}${version ? ` v${version}` : ' (latest)'} from the marketplace...`));
      const manifest = await CliUtils.getMarketplace().downloadAndInstall(normalizedSlug, new Set(), undefined, version);
      const newVersion = String((manifest as any)?.version || version || '');

      await db.update(
        PluginUpdateCommandService.TABLE,
        { slug: normalizedSlug },
        { version: newVersion, latestVersion: newVersion, hasUpdate: 0, updatedAt: new Date().toISOString() },
      );

      console.log(chalk.green(`\n✔ ${chalk.bold(normalizedSlug)} updated to v${newVersion}.`));
      console.log(chalk.gray('Restart the API process so the new plugin code loads.'));
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('\nPlugin update failed:'), error.message);
      process.exit(1);
    }
  }
}
