import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * A site's console path: the path on the site's own storefront hosts where its console answers
 * (`/admin`, `/backend`, `/team/console`), set on the site's form beside its host roles.
 *
 * NULL on every existing row, which means "no console on a path" — the console stays wherever the
 * site's admin-role hosts put it, exactly as before.
 */
export class SiteConsolePathMigration extends BaseMigration {
  readonly version = 67;
  readonly name = 'Site console path';
  /** One nullable column the running release neither reads nor writes. */
  readonly rollingSafe = true;

  private static readonly TABLE = '_system_tenants';

  async up(db: IDatabaseManager): Promise<void> {
    const { TABLE } = SiteConsolePathMigration;
    const columns = (await db.getColumns(TABLE)).map((name) => name.toLowerCase());
    // No columns at all means no table: there is nothing to add a column to (migration 39 owns it).
    if (!columns.length || columns.includes('console_path')) return;
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(`ALTER TABLE ${TABLE} ADD COLUMN console_path ${type.shortText}`));
  }
}
