import { Command } from 'commander';
import chalk from 'chalk';
import { PluginCommands } from '@cli/commands/plugin';
import { ThemeCommands } from '@cli/commands/theme';
import { DatabaseCommands } from '@cli/commands/database';
import { SystemCommands } from '@cli/commands/system';
import { QualityCommands } from '@cli/commands/quality';
import { AuthCommands } from '@cli/commands/auth';

/**
 * The `fromcode` CLI.
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
      .description('Fromcode CLI - Manage your headless CMS/Framework instance')
      .version('1.0.0');

    // Called directly rather than through a table of detached method references: a detached static
    // loses its `this`, and the indirection buys nothing over six lines.
    PluginCommands.registerPluginCommands(program);
    ThemeCommands.registerThemeCommands(program);
    DatabaseCommands.registerDatabaseCommands(program);
    SystemCommands.registerSystemCommands(program);
    QualityCommands.registerQualityCommands(program);
    AuthCommands.registerAuthCommands(program);

    program.on('command:*', () => FromcodeCli.rejectUnknown(program));
    return program;
  }

  /** An unrecognised command must fail loudly — a silent exit 0 reads as success. */
  private static rejectUnknown(program: Command): void {
    console.error(chalk.red('\nInvalid command: %s\nSee --help for a list of available commands.'), program.args.join(' '));
    process.exit(1);
  }
}
