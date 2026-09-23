import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';
import { SystemConstants } from '@core/constants/system.constants';
import { InitialFrameworkPostgresTables } from '@core/database/migrations/001_core_initial_schema-postgres-tables';
import { InitialFrameworkMysqlTables } from '@core/database/migrations/001_core_initial_schema-mysql-tables';
import { InitialFrameworkSqliteTables } from '@core/database/migrations/001_core_initial_schema-sqlite-tables';

/**
 * The core platform schema: plugins, themes, users, roles and permissions, sessions, settings, the
 * two journals (logs and the security audit log), scheduled tasks and media — with the permissions
 * every installation starts from.
 *
 * This is versions 1–8 and 43 consolidated, with the columns 13 added and the permission 18 seeded.
 * A database that ran them one by one has all of those versions recorded and runs nothing here; a
 * fresh install gets the same schema in one step. The tables are created in their final shape,
 * columns in the order they were once added, so the two are indistinguishable.
 */
export class InitialFrameworkMigration extends BaseMigration {
  readonly version = 1;
  readonly name = 'Core platform schema';

  /** Permissions a fresh install starts with: `[name, description, owner, group, impact]`. */
  private static readonly PERMISSIONS: ReadonlyArray<readonly [string, string, string, string, string]> = [
    ['*', 'Global super-user access to all system actions.', 'system', 'General', 'Critical'],
    ['api', 'Core API routing and middleware management.', 'system', 'system', 'High'],
    ['content', 'Dynamic content modeling and retrieval engine.', 'system', 'system', 'Medium'],
    ['i18n', 'Internationalization and localization services.', 'system', 'system', 'Low'],
    ['hooks', 'Events and lifecycle middleware injection.', 'system', 'system', 'High'],
    ['email', 'Transaction and automated email delivery systems.', 'system', 'system', 'Medium'],
    ['storage', 'Cloud and local filesystem storage abstraction.', 'system', 'system', 'Medium'],
    ['security', 'Authentication, encryption and RBAC enforcement.', 'system', 'system', 'Critical'],
    ['monitoring', 'System health, logs and performance telemetry.', 'system', 'system', 'Medium'],
    ['networking', 'External request handling and proxy services.', 'system', 'system', 'High'],
    ['backups', 'Database and asset snapshot management.', 'system', 'system', 'High'],
    ['admin', 'Access to the administrative control panel.', 'system', 'system', 'High'],
    ['frontend', 'Public-facing theme rendering and hydration.', 'system', 'system', 'Medium'],
    ['database:read', 'Low-level database selection and reading.', 'system', 'system', 'Medium'],
    ['database:write', 'Low-level database insertion and modification.', 'system', 'system', 'Critical'],
    ['users:manage', 'Management of system users and their profiles.', 'system', 'system', 'High'],
    ['roles:manage', 'Configuration of RBAC roles and permissions.', 'system', 'system', 'High'],
    ['settings:manage', 'Modification of global platform settings.', 'system', 'system', 'High'],
    ['plugins:manage', 'Installation and lifetime management of plugins.', 'system', 'system', 'Critical'],
    ['media:manage', 'Assets, folders and storage volume management.', 'system', 'system', 'Medium'],
    ['system:backup:view', 'View backup metadata and download backup archives.', 'system', 'system', 'High'],
    ['system:backup:manage', 'Create and delete managed backup archives.', 'system', 'system', 'Critical'],
    ['system:backup:restore', 'Preview and execute constrained backup restore operations.', 'system', 'system', 'Critical'],
    // Restarting a live server is a grant an operator makes explicitly, not part of `system:manage`.
    ['system:deploy:restart', 'Restart the api server process (deploy.restart MCP tool).', 'system', 'system', 'Critical'],
  ];

  /** Which role holds which permission on a fresh install: `[role, permission]`. */
  private static readonly ROLE_PERMISSIONS: ReadonlyArray<readonly [string, string]> = [
    ['admin', '*'],
    ['editor', 'content'],
    ['admin', 'system:backup:view'],
    ['admin', 'system:backup:manage'],
    ['admin', 'system:backup:restore'],
    ['admin', 'system:deploy:restart'],
  ];

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await InitialFrameworkPostgresTables.create(db);
        await db.execute(sql`
          INSERT INTO "_system_roles" ("slug", "name", "description", "type", "permissions")
          VALUES
            ('admin', 'Administrator', 'Full system access', 'system', '["*"]'::jsonb),
            ('editor', 'Editor', 'Content management only', 'custom', '["content:read", "content:write"]'::jsonb),
            ('user', 'User', 'Standard access', 'custom', '[]'::jsonb)
          ON CONFLICT DO NOTHING
        `);
      },
      sqlite: async () => {
        await InitialFrameworkSqliteTables.create(db);
        await db.execute(sql`
          INSERT OR IGNORE INTO "_system_roles" ("slug", "name", "description", "type", "permissions")
          VALUES
            ('admin', 'Administrator', 'Full system access', 'system', '["*"]'),
            ('editor', 'Editor', 'Content management only', 'custom', '["content:read", "content:write"]'),
            ('user', 'User', 'Standard access', 'custom', '[]')
        `);
      },
      // MySQL spells "insert if absent" `INSERT IGNORE`; the JSON columns take plain string literals.
      mysql: async () => {
        await InitialFrameworkMysqlTables.create(db);
        await db.execute(sql`
          INSERT IGNORE INTO "_system_roles" ("slug", "name", "description", "type", "permissions")
          VALUES
            ('admin', 'Administrator', 'Full system access', 'system', '["*"]'),
            ('editor', 'Editor', 'Content management only', 'custom', '["content:read", "content:write"]'),
            ('user', 'User', 'Standard access', 'custom', '[]')
        `);
      },
    });

    for (const [name, description, owner, group, impact] of InitialFrameworkMigration.PERMISSIONS) {
      await db.insert('_system_permissions', { name, description, plugin_slug: owner, group, impact });
    }
    for (const [role, permission] of InitialFrameworkMigration.ROLE_PERMISSIONS) {
      await db.insert('_system_roles_permissions', { role_slug: role, permission_name: permission });
    }

    // Through `createIndexIfMissing`, which is the form every dialect accepts: MySQL has no
    // `CREATE INDEX IF NOT EXISTS`, and its manager translates this statement and no other.
    await this.createIndexIfMissing(db, '_system_sessions', 'idx_sessions_user_id', ['user_id']);
    await this.createIndexIfMissing(db, SystemConstants.TABLE.LOGS, 'idx_system_logs_plugin_slug', ['plugin_slug']);
    await this.createIndexIfMissing(db, 'media', 'idx_media_folder_id', ['folder_id']);
    await this.createIndexIfMissing(db, SystemConstants.TABLE.AUDIT_LOGS, 'idx_audit_plugin', ['plugin_slug']);
    await this.createIndexIfMissing(db, SystemConstants.TABLE.AUDIT_LOGS, 'idx_audit_status', ['status']);
    // The columns the journal retention sweeps delete by, and the admin's Audit and Activity
    // screens order by. Without them every retention batch is a sequential scan.
    await this.createIndexIfMissing(db, SystemConstants.TABLE.AUDIT_LOGS, 'idx_system_audit_logs_created_at', ['created_at']);
    await this.createIndexIfMissing(db, SystemConstants.TABLE.LOGS, 'idx_system_logs_timestamp', ['timestamp']);
  }
}
