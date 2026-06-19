import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '../helpers/dialect';
import { InitialFrameworkSchemaStatements } from './001_core_initial_schema-statements';

class InitialFrameworkMigration extends BaseMigration {
  readonly version = 1;
  readonly name = 'Initial core framework schema';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await InitialFrameworkSchemaStatements.createPostgresTables(db);
      },
      sqlite: async () => {
        await InitialFrameworkSchemaStatements.createSqliteTables(db);
      }
    });

    // 13. System Seeding (Seed with agnostic insert if possible, or per-dialect)
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await InitialFrameworkSchemaStatements.seedPostgresRoles(db);
      },
      sqlite: async () => {
        await InitialFrameworkSchemaStatements.seedSqliteRoles(db);
      }
    });

    await InitialFrameworkSchemaStatements.seedPermissionsAndIndexes(db);
  }

  async down(db: IDatabaseManager): Promise<void> {
    const tables = [
      'media', 'media_folders', '_system_logs', '_system_sessions',
      '_system_meta', '_system_trusted_publishers', '_system_plugin_settings',
      '_system_roles_permissions', '_system_users_roles', '_system_themes',
      '_system_permissions', '_system_roles', 'users', '_system_plugins'
    ];
    for (const table of tables) {
      // CASCADE is pg specific, SQLite doesn't need it if we drop in order
      await DialectHelper.executeForDialect(db.dialect, {
        postgres: async () => await db.execute(sql`DROP TABLE IF EXISTS "${sql.raw(table)}" CASCADE`),
        default: async () => await db.execute(sql`DROP TABLE IF EXISTS "${sql.raw(table)}"`)
      });
    }
  }
}

export default new InitialFrameworkMigration();
