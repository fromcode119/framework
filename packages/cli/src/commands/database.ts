import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { MigrationManager, Seeder, DatabaseConnectionFileService, DatabaseRoleBootstrapService } from '@fromcode119/core';
import { DatabaseFactory } from '@fromcode119/database';
import { CliUtils } from '@cli/utils';

export class DatabaseCommands {
  /**
   * `atlantis db bootstrap-roles` — creates the logins the app runs as, from a privileged connection.
   *
   * Runs from the container entrypoint BEFORE the application starts, so the privileged URL lives only
   * for this command; the entrypoint unsets it before exec'ing the app. Absent that variable this is a
   * no-op, which is the correct behaviour for a managed database where the operator owns role creation.
   */
  private static registerBootstrapRoles(db: Command): void {
    db
      .command('bootstrap-roles')
      .description('Create or realign the database logins named by DATABASE_URL / DATABASE_MIGRATION_URL')
      .action(async () => {
        // The roles to create are named by the runtime connections, which on an installation set up
        // through the wizard live in the data directory rather than the environment. Without this the
        // command would find nothing to provision on exactly the deployments that need it most.
        DatabaseConnectionFileService.adopt();

        const url = process.env[DatabaseRoleBootstrapService.BOOTSTRAP_URL_ENV];
        if (!url) {
          console.log(chalk.gray(`${DatabaseRoleBootstrapService.BOOTSTRAP_URL_ENV} is not set; leaving database roles to the operator.`));
          process.exit(0);
        }

        const database = DatabaseFactory.create(url);
        try {
          await database.connect();
          await DatabaseRoleBootstrapService.run(database as any);
          console.log(chalk.green('✔ Database roles are in place.'));
          process.exit(0);
        } catch (error: any) {
          console.error(chalk.red('Could not provision database roles:'), error.message);
          process.exit(1);
        }
        // No teardown: the managers expose none, and this command exits, which closes the pool with it.
      });
  }

  /**
   * `atlantis db init-bundled-superuser` — invent the bundled database's superuser password, once.
   *
   * A deployment that ships its own PostgreSQL still has to tell the image a password before it will
   * initialise, and that was the last credential an operator had to invent by hand. Compose cannot
   * generate one, and the api cannot either — it starts AFTER the database it would be generating
   * the password for. So this runs as a one-shot before both of them.
   *
   * WRITTEN ONCE AND NEVER REWRITTEN. The password is what the existing data directory was
   * initialised with; regenerating it would leave a database nobody can open. The file is owned by
   * the postgres uid and readable by nobody else, so the application account — which shares this
   * volume for the entrypoint's sake — cannot read the superuser credential it must never hold.
   */
  private static registerInitBundledSuperuser(db: Command): void {
    db
      .command('init-bundled-superuser')
      .description('Generate the bundled database superuser password on first start (no-op afterwards)')
      .requiredOption('--file <path>', 'Where to write the password')
      .option('--uid <uid>', 'Owner uid for the file — the database image\'s own user', '70')
      .action(async (options: { file: string; uid: string }) => {
        const file = path.resolve(options.file);
        if (fs.existsSync(file) && String(fs.readFileSync(file, 'utf8')).trim()) {
          console.log(chalk.gray(`${file} already holds a password; leaving it alone.`));
          process.exit(0);
        }

        try {
          const { randomBytes } = await import('crypto');
          // A deployment that supplied its own password keeps it: this stores that value rather than
          // generating one, so the database is still created with what the operator chose. The image
          // refuses to start when POSTGRES_PASSWORD and POSTGRES_PASSWORD_FILE are both set, so the
          // file is the single path either way.
          const supplied = String(process.env.POSTGRES_PASSWORD || '').trim();
          const password = supplied || randomBytes(32).toString('hex');

          fs.mkdirpSync(path.dirname(file));
          fs.writeFileSync(file, `${password}\n`, { mode: 0o400 });
          // Readable by the database image's user and by root, and by nothing else — in particular
          // not by the account the application runs as, which shares this volume.
          fs.chownSync(file, Number(options.uid), Number(options.uid));
          fs.chmodSync(file, 0o400);
          console.log(chalk.green(
            supplied
              ? `✔ Stored the supplied database superuser password into ${file}.`
              : `✔ Generated the bundled database superuser password into ${file}.`,
          ));
          process.exit(0);
        } catch (error: any) {
          console.error(chalk.red('Could not generate the bundled database password:'), error.message);
          process.exit(1);
        }
      });
  }

  static registerDatabaseCommands(program: Command) {
    const db = program.command('db').description('Manage database');

    db
      .command('migrate')
      .description('Run database migrations')
      .action(async () => {
        try {
          console.log(chalk.blue('\nRunning migrations...'));
          const database = await CliUtils.getDatabase();
          const migrationManager = new MigrationManager(database);

          await migrationManager.migrate();

          console.log(chalk.green('✔ Migrations completed successfully.'));
          process.exit(0);
        } catch (error: any) {
          console.error(chalk.red('Migration failed:'), error.message);
          process.exit(1);
        }
      });

    DatabaseCommands.registerBootstrapRoles(db);
    DatabaseCommands.registerInitBundledSuperuser(db);

    db
      .command('rollback')
      .description('Rollback the last migration batch')
      .action(async () => {
        try {
          console.log(chalk.blue('\nRolling back migrations...'));
          const database = await CliUtils.getDatabase();
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
          const database = await CliUtils.getDatabase();
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
            const confirm = await DatabaseCommands.askQuestion('ARE YOU SURE? This will DELETE ALL DATA and reset the database. (y/N): ');
            if (confirm.toLowerCase() !== 'y') {
              console.log('Reset cancelled.');
              return;
            }
          }

          console.log(chalk.blue('\nResetting database...'));
          const database = await CliUtils.getDatabase();
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
  static askQuestion(question: string): Promise<string> {
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
}