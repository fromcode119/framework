import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * `deploy.restart` (MCP) deliberately carries its OWN permission instead of riding on
 * `system:manage`, so restarting a live server is a grant an operator makes explicitly. Seeded here
 * so the admin Roles UI can actually grant it — a permission no control can grant would be magic.
 */
export class AddSystemDeployPermissionMigration extends BaseMigration {
  readonly version = 18;
  readonly name = 'Add system deploy permission';

  async up(db: IDatabaseManager): Promise<void> {
    const permissions = [
      ['system:deploy:restart', 'Restart the api server process (deploy.restart MCP tool).', 'system', 'system', 'Critical'],
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
    await db.delete('_system_roles_permissions', { role_slug: 'admin', permission_name: 'system:deploy:restart' });
    await db.delete('_system_permissions', { name: 'system:deploy:restart' });
  }
}
