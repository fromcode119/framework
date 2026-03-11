import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { CliUtils } from '../utils';


export class QualityCommands {
  static registerQualityCommands(program: Command) {
    program
      .command('test')
      .description('Run automated tests (unit and integration)')
      .option('--package <name>', 'Run tests for a specific package only')
      .action(async (options) => {
        const root = CliUtils.getProjectRoot();
        console.log(chalk.blue(`\n🚀 Running tests...`));

        try {
          const cmd = options.package
            ? `npm run test --workspace=@fromcode119/${options.package}`
            : `npm run test`;

          execSync(cmd, { stdio: 'inherit', cwd: root });
          console.log(chalk.green('\n✅ Tests completed successfully.'));
        } catch (error) {
          console.error(chalk.red('\n❌ Tests failed.'));
          process.exit(1);
        }
      });

    program
      .command('lint')
      .description('Run linting checks across the project')
      .action(async () => {
        const root = CliUtils.getProjectRoot();
        console.log(chalk.blue(`\n🔍 Running linting checks...`));

        try {
          // Try to run a global lint script if it exists, otherwise use a default command
          const pkg = await fs.readJson(path.join(root, 'package.json'));
          const cmd = pkg.scripts?.lint ? 'npm run lint' : 'npx eslint "packages/*/src/**/*.{ts,tsx}" --fix';

          execSync(cmd, { stdio: 'inherit', cwd: root });
          console.log(chalk.green('\n✅ Linting passed.'));
        } catch (error) {
          console.error(chalk.red('\n❌ Linting issues found.'));
          process.exit(1);
        }
      });

    program
      .command('typecheck')
      .description('Run TypeScript type checking')
      .action(async () => {
        const root = CliUtils.getProjectRoot();
        console.log(chalk.blue(`\nTypeScript checking...`));

        try {
          execSync('npx tsc --noEmit', { stdio: 'inherit', cwd: root });
          console.log(chalk.green('\n✅ Type checking passed.'));
        } catch (error) {
          console.error(chalk.red('\n❌ Type errors found.'));
          process.exit(1);
        }
      });

    program
      .command('doctor')
      .description('Perform system health diagnostics')
      .action(async () => {
        const root = CliUtils.getProjectRoot();
        console.log(chalk.blue(`\n🏥 Starting Fromcode System Health Check...\n`));

        const checks = [
          { name: 'Node.js Version', check: () => process.version.startsWith('v20') || process.version.startsWith('v22') || process.version.startsWith('v18') },
          { name: 'Environment File', check: () => fs.existsSync(path.join(root, '.env')) },
          {
            name: 'Database Configuration', check: async () => {
              const envPath = path.join(root, '.env');
              if (!fs.existsSync(envPath)) return false;
              const env = (await fs.readFile(envPath, 'utf8'));
              return env.includes('DATABASE_URL=');
            }
          },
          { name: 'Uploads Directory', check: () => fs.existsSync(path.join(root, 'public/uploads')) },
          {
            name: 'Storage Backend', check: async () => {
              const envPath = path.join(root, '.env');
              if (!fs.existsSync(envPath)) return false;
              const env = (await fs.readFile(envPath, 'utf8'));
              return env.includes('STORAGE_DRIVER=');
            }
          }
        ];

        let allPassed = true;

        for (const check of checks) {
          try {
            const result = await check.check();
            if (result) {
              console.log(`${chalk.green('✓')} ${check.name}`);
            } else {
              console.log(`${chalk.red('✗')} ${check.name} ${chalk.gray('(Action required)')}`);
              allPassed = false;
            }
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.log(`${chalk.red('✗')} ${check.name} ${chalk.gray(`(Error: ${message})`)}`);
            allPassed = false;
          }
        }

        // Check DB connection if DATABASE_URL is present
        if (allPassed) {
          console.log(chalk.gray('\nTesting database connection...'));
          try {
            // We can't easily import the core database manager here without complex setup
            // but we can check if pg_isready or similar exists if it's postgres
            const envPath = path.join(root, '.env');
            const env = await fs.readFile(envPath, 'utf8');
            const match = env.match(/DATABASE_URL="?([^"\s]+)"?/);
            if (match && match[1].startsWith('postgres')) {
              try {
                // Basic check if we can reach the port
                const url = new URL(match[1]);
                execSync(`nc -z -w 2 ${url.hostname} ${url.port || 5432}`, { stdio: 'ignore' });
                console.log(`${chalk.green('✓')} Database Connection (Network reachable)`);
              } catch (e) {
                console.log(`${chalk.yellow('!')} Database Connection (Port unreachable - check if DB is running)`);
              }
            }
          } catch (e) { }
        }

        if (allPassed) {
          console.log(chalk.green(`\n✨ Your system is healthy! Everything looks good to go.\n`));
        } else {
          console.log(chalk.yellow(`\n⚠️  Some potential issues were found. Please review the checklist above.\n`));
        }
      });
  }
}