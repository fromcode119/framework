import { Command } from 'commander';
import chalk from 'chalk';
import { PluginCommands } from '@cli/commands/plugin';
import { ThemeCommands } from '@cli/commands/theme';
import { DatabaseCommands } from '@cli/commands/database';
import { SystemCommands } from '@cli/commands/system';
import { QualityCommands } from '@cli/commands/quality';
import { AuthCommands } from '@cli/commands/auth';
import { ExtensionBuildCommandService } from '@cli/commands/extension-build-command-service';
import { DeployCommandService } from '@cli/commands/deploy-command-service';

/**
 * The `fromcode` CLI.
 *
 * The command follows the brand, Fromcode Framework, never a release name: Atlantis is one release,
 * the next has another, and a command named after it would be wrong the day that release ships.
 * `atlantis` stays as a second bin name and npm script for the same entry, because the command
 * carried that name for a while and a rename that silently broke every script, deploy target and
 * shell history would cost more than the clarity is worth.
 *
 * `bin.ts` is the process entry and does nothing but call `main` — the program is built here so the
 * construction is a method rather than module-level statements, and so it can be exercised without
 * spawning a process.
 */
export class FromcodeCli {
  static main(argv: string[]): void {
    const program = FromcodeCli.build();

    // No arguments is a request for help, not an error — commander would otherwise exit silently.
    if (!argv.slice(2).length) {
      program.outputHelp();
      return;
    }
    program.parse(argv);
  }

  /** The configured program: metadata, every command group, and the unknown-command handler. */
  private static build(): Command {
    const program = new Command();

    program
      .name('fromcode')
      .description('Fromcode Framework CLI - manage this installation')
      .version('1.0.0');

    // Called directly rather than through a table of detached method references: a detached static
    // loses its `this`, and the indirection buys nothing over six lines.
    ExtensionBuildCommandService.register(program);
    PluginCommands.registerPluginCommands(program);
    ThemeCommands.registerThemeCommands(program);
    DatabaseCommands.registerDatabaseCommands(program);
    SystemCommands.registerSystemCommands(program);
    QualityCommands.registerQualityCommands(program);
    AuthCommands.registerAuthCommands(program);
    DeployCommandService.register(program);

    program.on('command:*', () => FromcodeCli.rejectUnknown(program));
    return program;
  }

  /** An unrecognised command must fail loudly — a silent exit 0 reads as success. */
  private static rejectUnknown(program: Command): void {
    console.error(chalk.red('\nInvalid command: %s\nSee --help for a list of available commands.'), program.args.join(' '));
    process.exit(1);
  }
}
