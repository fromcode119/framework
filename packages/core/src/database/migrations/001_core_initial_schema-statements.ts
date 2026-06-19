import { IDatabaseManager, sql } from '@fromcode119/database';
import { InitialFrameworkPostgresTables } from './001_core_initial_schema-postgres-tables';
import { InitialFrameworkSqliteTables } from './001_core_initial_schema-sqlite-tables';

/**
 * Table-creation and seed statements for the initial framework migration. Each method
 * issues the SAME `db.execute(sql\`...\`)` operations, in the SAME ORDER, that previously
 * lived inline in {@link InitialFrameworkMigration.up}. Splitting only relocates the
 * statements; the emitted SQL is byte-for-byte identical.
 */
export class InitialFrameworkSchemaStatements {
  static async createPostgresTables(db: IDatabaseManager): Promise<void> {
    await InitialFrameworkPostgresTables.create(db);
  }

  static async createSqliteTables(db: IDatabaseManager): Promise<void> {
    await InitialFrameworkSqliteTables.create(db);
  }

  static async seedPostgresRoles(db: IDatabaseManager): Promise<void> {
    await db.execute(sql`
          INSERT INTO "_system_roles" ("slug", "name", "description", "type", "permissions")
          VALUES
            ('admin', 'Administrator', 'Full system access', 'system', '["*"]'::jsonb),
            ('editor', 'Editor', 'Content management only', 'custom', '["content:read", "content:write"]'::jsonb),
            ('user', 'User', 'Standard access', 'custom', '[]'::jsonb)
          ON CONFLICT DO NOTHING
        `);
  }

  static async seedSqliteRoles(db: IDatabaseManager): Promise<void> {
    await db.execute(sql`
          INSERT OR IGNORE INTO "_system_roles" ("slug", "name", "description", "type", "permissions")
          VALUES
            ('admin', 'Administrator', 'Full system access', 'system', '["*"]'),
            ('editor', 'Editor', 'Content management only', 'custom', '["content:read", "content:write"]'),
            ('user', 'User', 'Standard access', 'custom', '[]')
        `);
  }

  static async seedPermissionsAndIndexes(db: IDatabaseManager): Promise<void> {
    // Permissions (Full Capabilities) - Seed with agnostic insert to save space
    const permissions = [
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
      ['media:manage', 'Assets, folders and storage volume management.', 'system', 'system', 'Medium']
    ];

    for (const [name, desc, slug, group, impact] of permissions) {
       await db.insert('_system_permissions', { name, description: desc, plugin_slug: slug, group, impact });
    }

    // Role Mapping
    await db.insert('_system_roles_permissions', { role_slug: 'admin', permission_name: '*' });
    await db.insert('_system_roles_permissions', { role_slug: 'editor', permission_name: 'content' });

    // Indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "_system_sessions"("user_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_system_logs_plugin_slug" ON "_system_logs"("plugin_slug")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_media_folder_id" ON "media"("folder_id")`);
  }
}
