import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * Adds the read-only `inspector` role: an account holding it sees what an administrator sees and can
 * change nothing — the access a tax inspector is owed on request. The request gate enforces it (see
 * `InspectorAccess` in the auth package); this only makes the role exist so an operator can grant it.
 *
 * Its permissions are not empty on purpose: the site switcher offers a site to roles that carry
 * permissions, and an inspector must be able to enter the site it inspects.
 */
export class ReadOnlyInspectorRoleMigration extends BaseMigration {
  readonly version = 55;
  readonly name = 'Read-only inspector role';

  async up(db: IDatabaseManager): Promise<void> {
    // A database that recorded the consolidated range without running it has no roles yet to add to.
    if (!(await db.tableExists('_system_roles'))) return;
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(Sql.query`
          INSERT INTO "_system_roles" ("slug", "name", "description", "type", "permissions")
          VALUES ('inspector', 'Inspector (read-only)', 'Sees everything an administrator sees and cannot change anything. Give it to an account for an inspection, take it away after.', 'system', '["database:read"]'::jsonb)
          ON CONFLICT DO NOTHING
        `);
      },
      sqlite: async () => {
        await db.execute(Sql.query`
          INSERT OR IGNORE INTO "_system_roles" ("slug", "name", "description", "type", "permissions")
          VALUES ('inspector', 'Inspector (read-only)', 'Sees everything an administrator sees and cannot change anything. Give it to an account for an inspection, take it away after.', 'system', '["database:read"]')
        `);
      },
      mysql: async () => {
        await db.execute(Sql.query`
          INSERT IGNORE INTO "_system_roles" ("slug", "name", "description", "type", "permissions")
          VALUES ('inspector', 'Inspector (read-only)', 'Sees everything an administrator sees and cannot change anything. Give it to an account for an inspection, take it away after.', 'system', '["database:read"]')
        `);
      },
    });
    if (!(await db.findOne('_system_roles_permissions', { role_slug: 'inspector', permission_name: 'database:read' }))) {
      await db.insert('_system_roles_permissions', { role_slug: 'inspector', permission_name: 'database:read' });
    }
  }
}
