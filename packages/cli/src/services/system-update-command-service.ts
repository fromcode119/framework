import { Command } from 'commander';
import chalk from 'chalk';
import { SystemUpdateService } from '@fromcode119/core';
import { CliUtils } from '../utils';

/**
 * Terminal download + update for the framework core. `check-update` queries the configured
 * marketplace registry; `update` downloads the new core and applies it (with an automatic
 * pre-update backup), or applies a local `--archive` package offline. Wraps the same
 * SystemUpdateService the admin UI uses, so the behaviour is identical without the browser.
 */
export class SystemUpdateCommandService {
  static register(system: Command): void {
    system
      .command('check-update')
      .description('Check the marketplace for a newer framework core version')
      .action(async () => {
        await SystemUpdateCommandService.checkUpdate();
      });

    system
      .command('update')
      .description('Download and apply a framework core update (auto-backup first)')
      .option('--archive <path>', 'Apply a local core package (.zip/.tar.gz) instead of downloading')
      .option('--yes', 'Skip the confirmation prompt')
      .action(async (options: { archive?: string; yes?: boolean }) => {
        await SystemUpdateCommandService.update(options);
      });
  }

  private static async checkUpdate(): Promise<void> {
    try {
      console.log(chalk.blue('\nChecking marketplace for framework updates...'));
      const status = await SystemUpdateService.checkUpdate();
      if (!status) {
        console.log(chalk.yellow('The marketplace did not return core version information.'));
        process.exit(0);
      }
      console.log(`${chalk.bold('Installed:')} ${status.current}`);
      console.log(`${chalk.bold('Latest:')}    ${status.latest}`);
      if (status.hasUpdate) {
        console.log(chalk.green('\nAn update is available. Run "fromcode system update" to apply it.'));
      } else {
        console.log(chalk.green('\nYou are on the latest framework core.'));
      }
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('Update check failed:'), error.message);
      process.exit(1);
    }
  }

  private static async update(options: { archive?: string; yes?: boolean }): Promise<void> {
    try {
      if (!options.yes) {
        const what = options.archive ? `local archive ${options.archive}` : 'the latest marketplace core';
        const answer = await CliUtils.ask(chalk.yellow(`Apply ${what}? A backup is taken first. [y/N] `));
        if (!/^y(es)?$/i.test(answer.trim())) {
          console.log(chalk.gray('Aborted.'));
          process.exit(0);
        }
      }

      console.log(chalk.blue('\nApplying framework update (this may take a while)...'));
      const result = options.archive
        ? await SystemUpdateService.applyArchive(options.archive)
        : await SystemUpdateService.applyUpdate();

      console.log(chalk.green(`\n✔ Framework core updated to v${result.version}.`));
      console.log(chalk.gray('Restart the API/admin processes for the new core to take effect.'));
      process.exit(0);
    } catch (error: any) {
      console.error(chalk.red('\nUpdate failed:'), error.message);
      console.error(chalk.gray('A pre-update backup was created (or the update aborted before any change).'));
      process.exit(1);
    }
  }
}
