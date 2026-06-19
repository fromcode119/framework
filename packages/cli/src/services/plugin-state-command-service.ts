import { Command } from 'commander';
import chalk from 'chalk';
import { SystemConstants } from '@fromcode119/core';
import { CliUtils } from '../utils';

/**
 * Offline plugin-state recovery. Talks DIRECTLY to the database (the `_system_plugins` registry),
 * never through the running API. Use it to re-enable a plugin that got stuck in `error`/`disabled`
 * (e.g. after an integrity/capability violation) or to disable a plugin that is breaking boot —
 * all without the admin UI. Restart the API process afterwards for the change to take effect.
 */
export class PluginStateCommandService {
  private static readonly TABLE = SystemConstants.TABLE.PLUGINS;
  private static readonly STATE_ACTIVE = 'active';
  private static readonly STATE_DISABLED = 'disabled';

  static register(plugin: Command): void {
    plugin
      .command('state')
      .description('Show every plugin\'s state and version (from the registry)')
      .action(async () => {
        await PluginStateCommandService.showState();
      });

    plugin
      .command('enable <slug>')
      .description('Re-enable a disabled/errored plugin (sets state=active)')
      .action(async (slug: string) => {
        await PluginStateCommandService.setState(slug, PluginStateCommandService.STATE_ACTIVE);
      });

    plugin
      .command('disable <slug>')
      .description('Disable a plugin that is breaking boot (sets state=disabled)')
      .action(async (slug: string) => {
        await PluginStateCommandService.setState(slug, PluginStateCommandService.STATE_DISABLED);
      });
  }

  private static async showState(): Promise<void> {
    const db = await CliUtils.getDatabase();
    try {
      const rows = await db.find(PluginStateCommandService.TABLE, { orderBy: { slug: 'asc' }, limit: 1000 });
      console.log(chalk.white(`\n${rows.length} plugin(s):`));
      console.log(chalk.gray('--------------------------------------------------'));
      for (const row of rows) {
        const state = String(row.state || 'unknown');
        const color = state === PluginStateCommandService.STATE_ACTIVE ? chalk.green : state === 'error' ? chalk.red : chalk.yellow;
        const health = row.healthStatus ? chalk.gray(` health:${row.healthStatus}`) : '';
        console.log(`${color(state.padEnd(9))} ${chalk.bold(row.slug)} ${chalk.gray('v' + (row.version || '?'))}${health}`);
      }
      console.log('');
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('Failed to read plugin state:'), error.message);
      process.exit(1);
    }
  }

  private static async setState(slug: string, state: string): Promise<void> {
    const normalizedSlug = String(slug || '').trim();
    const db = await CliUtils.getDatabase();
    try {
      const row = await db.findOne(PluginStateCommandService.TABLE, { slug: normalizedSlug });
      if (!row) {
        console.error(chalk.red(`No installed plugin with slug: ${normalizedSlug}`));
        console.error(chalk.gray('Use "fromcode plugin state" to list installed plugins.'));
        process.exit(1);
      }
      await db.update(
        PluginStateCommandService.TABLE,
        { slug: normalizedSlug },
        { state, updatedAt: new Date().toISOString() },
      );
      console.log(chalk.green(`✔ ${chalk.bold(normalizedSlug)} → state=${state}.`));
      console.log(chalk.gray('Restart the API process for the change to take effect.'));
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('Failed to update plugin state:'), error.message);
      process.exit(1);
    }
  }
}
