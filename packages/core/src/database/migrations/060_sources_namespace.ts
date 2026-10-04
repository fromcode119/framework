import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * The vendor of what a source last built, beside its version.
 *
 * An extension's `namespace` decides whether an install is refused (a same-slug package from another
 * vendor never replaces an installed one), so the operator has to be able to see it on the row that
 * builds the package. Filled by the next build of each source; empty until then.
 */
export class SourcesNamespaceMigration extends BaseMigration {
  readonly version = 60;
  readonly name = 'Sources namespace';
  /** One nullable column the running release neither reads nor writes. */
  readonly rollingSafe = true;

  private static readonly TABLE = '_system_sources_builds';

  private static readonly COLUMN = 'namespace';

  async up(db: IDatabaseManager): Promise<void> {
    const { TABLE, COLUMN } = SourcesNamespaceMigration;
    const columns = (await db.getColumns(TABLE)).map((name) => name.toLowerCase());
    // No columns at all means no table: there is nothing to add a column to (migrations 31/53 own it).
    if (!columns.length || columns.includes(COLUMN)) return;
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(`ALTER TABLE ${TABLE} ADD COLUMN ${COLUMN} ${type.shortText}`));
  }
}
