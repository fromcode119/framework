#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { registerPluginCommands } from './commands/plugin';
import { registerThemeCommands } from './commands/theme';
import { registerDatabaseCommands } from './commands/database';
import { registerSystemCommands } from './commands/system';
import { registerQualityCommands } from './commands/quality';

const program = new Command();

program
  .name('fromcode')
  .description('Fromcode CLI - Manage your headless CMS/Framework instance')
  .version('1.0.0');

// Register modular commands
registerPluginCommands(program);
registerThemeCommands(program);
registerDatabaseCommands(program);
registerSystemCommands(program);
registerQualityCommands(program);

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
