#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { PluginCommands } from './commands/plugin';
import { ThemeCommands } from './commands/theme';
import { DatabaseCommands } from './commands/database';
import { SystemCommands } from './commands/system';
import { QualityCommands } from './commands/quality';

const program = new Command();

program
  .name('fromcode')
  .description('Fromcode CLI - Manage your headless CMS/Framework instance')
  .version('1.0.0');

// Register modular commands
PluginCommands.registerPluginCommands(program);
ThemeCommands.registerThemeCommands(program);
DatabaseCommands.registerDatabaseCommands(program);
SystemCommands.registerSystemCommands(program);
QualityCommands.registerQualityCommands(program);

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('\nInvalid command: %s\nSee --help for a list of available commands.'), program.args.join(' '));
  process.exit(1);
});

// Start the CLI
if (!process.argv.slice(2).length) {
  program.outputHelp();
} else {
  program.parse(process.argv);
}
