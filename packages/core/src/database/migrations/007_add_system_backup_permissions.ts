import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '../helpers/dialect';

class AddSystemBackupPermissionsMigration extends BaseMigration {
  readonly version = 7;
  readonly name = 'Add system backup permissions';

  async up(db: IDatabaseManager): Promise<void> {
    const permissions = [
      ['system:backup:view', 'View backup metadata and download backup archives.', 'system', 'system', 'High'],
      ['system:backup:manage', 'Create and delete managed backup archives.', 'system', 'system', 'Critical'],
      ['system:backup:restore', 'Preview and execute constrained backup restore operations.', 'system', 'system', 'Critical'],
    ] as const;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        for (const [name, description, pluginSlug, group, impact] of permissions) {
          await db.execute(sql`
            INSERT INTO "_system_permissions" ("name", "description", "plugin_slug", "group", "impact")
            VALUES (${name}, ${description}, ${pluginSlug}, ${group}, ${impact})
            ON CONFLICT ("name") DO NOTHING
          `);
          await db.execute(sql`
            INSERT INTO "_system_roles_permissions" ("role_slug", "permission_name")
            VALUES ('admin', ${name})
            ON CONFLICT ("role_slug", "permission_name") DO NOTHING
          `);
        }
      },
      sqlite: async () => {
        for (const [name, description, pluginSlug, group, impact] of permissions) {
          await db.execute(sql`
            INSERT OR IGNORE INTO "_system_permissions" ("name", "description", "plugin_slug", "group", "impact")
            VALUES (${name}, ${description}, ${pluginSlug}, ${group}, ${impact})
          `);
          await db.execute(sql`
            INSERT OR IGNORE INTO "_system_roles_permissions" ("role_slug", "permission_name")
            VALUES ('admin', ${name})
          `);
        }
      },
    });
  }

  async down(db: IDatabaseManager): Promise<void> {
    const permissionNames = ['system:backup:view', 'system:backup:manage', 'system:backup:restore'];
    for (const permissionName of permissionNames) {
      await db.delete('_system_roles_permissions', { role_slug: 'admin', permission_name: permissionName });
      await db.delete('_system_permissions', { name: permissionName });
    }
  }
}

export default new AddSystemBackupPermissionsMigration();