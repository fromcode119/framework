import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { CliUtils } from '../utils';


export class SystemCommands {
  static registerSystemCommands(program: Command) {
    program
      .command('version')
      .description('Show system version information')
      .action(async () => {
        try {
          const root = CliUtils.getProjectRoot();
          const pkgPath = path.join(root, 'package.json');
          const pkg = await fs.readJson(pkgPath);

          console.log(chalk.blue('\nFromcode System Information:'));
          console.log(`${chalk.bold('CLI Version:')} ${pkg.version}`);
          console.log(`${chalk.bold('Environment:')} ${process.env.NODE_ENV || 'development'}`);
          console.log(`${chalk.bold('Project Root:')} ${root}`);

          // Check for core version
          try {
            const corePkg = await fs.readJson(path.join(root, 'packages/core/package.json'));
            console.log(`${chalk.bold('Core Version:')} ${corePkg.version}`);
          } catch (e) { }

        } catch (error) {
          console.log(chalk.red('Could not retrieve version information.'));
        }
      });

    program
      .command('info')
      .description('Display debug information about the environment')
      .action(() => {
        console.log(chalk.blue('\nDebug Info:'));
        console.log(`- Platform: ${process.platform}`);
        console.log(`- Node Version: ${process.version}`);
        console.log(`- Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
        console.log(`- Architecture: ${process.arch}`);
      });
  }
}