import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { MigrationManager, Seeder } from '@fromcode119/core';
import { getDatabase } from '../utils';

export function registerDatabaseCommands(program: Command) {
  const db = program.command('db').description('Manage database');

  db
    .command('migrate')
    .description('Run database migrations')
    .action(async () => {
      try {
        console.log(chalk.blue('\nRunning migrations...'));
        const database = await getDatabase();
        const migrationManager = new MigrationManager(database);
        
        await migrationManager.migrate();
        
        console.log(chalk.green('✔ Migrations completed successfully.'));
        process.exit(0);
      } catch (error: any) {
        console.error(chalk.red('Migration failed:'), error.message);
        process.exit(1);
      }
    });

  db
    .command('rollback')
    .description('Rollback the last migration batch')
    .action(async () => {
      try {
        console.log(chalk.blue('\nRolling back migrations...'));
        const database = await getDatabase();
        const migrationManager = new MigrationManager(database);
        
        await migrationManager.rollback();
        
        console.log(chalk.green('✔ Rollback completed successfully.'));
        process.exit(0);
      } catch (error: any) {
        console.error(chalk.red('Rollback failed:'), error.message);
        process.exit(1);
      }
    });

  db
    .command('status')
    .description('Check migration status')
    .action(async () => {
        console.log(chalk.yellow('Feature in progress: Use "db migrate" to ensure up to date.'));
        process.exit(0);
    });

  db
    .command('seed')
    .description('Seed the database with initial data')
    .option('-f, --file <path>', 'Custom seed file path')
    .action(async (options) => {
      try {
        console.log(chalk.blue('\nSeeding database...'));
        const database = await getDatabase();
        const seeder = new Seeder(database);
        
        let seedFile = options.file;
        if (!seedFile) {
            // Look for default seed file if not provided
            const potentialSeeds = [
              'src/database/seeds/default.ts',
              'src/database/seeds/default.js',
              'database/seeds/default.ts',
              'database/seeds/default.js',
              'seeds/default.ts',
              'seeds/default.js'
            ];
            
            for (const p of potentialSeeds) {
              if (fs.existsSync(path.join(process.cwd(), p))) {
                seedFile = p;
                break;
              }
            }
        }

        if (!seedFile) {
          throw new Error('No seed file provided or found. Use --file <path>.');
        }

        await seeder.seed(seedFile);
        
        console.log(chalk.green('Seeding completed successfully!'));
        process.exit(0);
      } catch (error: any) {
        console.error(chalk.red('Seeding failed:'), error.message);
        process.exit(1);
      }
    });

  db
    .command('reset')
    .description('Reset the database (drop all tables and re-migrate)')
    .option('-y, --yes', 'Skip confirmation', false)
    .action(async (options) => {
      try {
        if (!options.yes) {
          const confirm = await ask('ARE YOU SURE? This will DELETE ALL DATA and reset the database. (y/N): ');
          if (confirm.toLowerCase() !== 'y') {
            console.log('Reset cancelled.');
            return;
          }
        }

        console.log(chalk.blue('\nResetting database...'));
        const database = await getDatabase();
        const migrationManager = new MigrationManager(database);
        
        await migrationManager.reset();
        await migrationManager.migrate();
        
        console.log(chalk.green('✔ Database reset and re-migrated successfully!'));
        process.exit(0);
        
      } catch (error: any) {
        console.error(chalk.red('Reset failed:'), error.message);
      }
    });
}

// Minimal ask helper since we are in a sub-command and don't want to import everything
function ask(question: string): Promise<string> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  
    return new Promise((resolve) => {
      rl.question(question, (answer: string) => {
        rl.close();
        resolve(answer);
      });
    });
}
