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
 * The `atlantis` CLI.
 *
 * `fromcode` is kept as a second name for the same binary. The framework is Atlantis and the company
 * is Fromcode, so the command follows the framework — but a rename that silently broke every script,
 * deploy target and shell history would cost more than the clarity is worth.
 *
 * `bin.ts` is the process entry and does nothing but call `main` — the program is built here so the
 * construction is a method rather than module-level statements, and so it can be exercised without
 * spawning a process.
 */
export class AtlantisCli {
  static main(argv: string[]): void {
    const program = AtlantisCli.build();

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
      .name('atlantis')
      .description('Atlantis CLI - manage this Fromcode Atlantis installation')
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

    program.on('command:*', () => AtlantisCli.rejectUnknown(program));
    return program;
  }

  /** An unrecognised command must fail loudly — a silent exit 0 reads as success. */
  private static rejectUnknown(program: Command): void {
    console.error(chalk.red('\nInvalid command: %s\nSee --help for a list of available commands.'), program.args.join(' '));
    process.exit(1);
  }
}
