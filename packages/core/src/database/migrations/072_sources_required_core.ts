import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * The core version a source's last build needs (its manifest's `engines.core`), beside the version.
 *
 * Without it, the catalogue a Sources installation offers carries no core requirement, so the install
 * gate can only refuse an incompatible plugin AFTER it is downloaded — holding it at boot — rather than
 * before. With it, a Sources update whose core this installation does not run is refused up front and the
 * working version keeps running. Filled by the next build of each source; empty until then.
 */
export class SourcesRequiredCoreMigration extends BaseMigration {
  readonly version = 72;
  readonly name = 'Sources required core';
  /** One nullable column the running release neither reads nor writes. */
  readonly rollingSafe = true;

  private static readonly TABLE = '_system_sources_builds';
  private static readonly COLUMN = 'required_core';

  async up(db: IDatabaseManager): Promise<void> {
    const { TABLE, COLUMN } = SourcesRequiredCoreMigration;
    const columns = (await db.getColumns(TABLE)).map((name) => name.toLowerCase());
    // No columns at all means no table: there is nothing to add a column to (migrations 31/53 own it).
    if (!columns.length || columns.includes(COLUMN)) return;
    const type = PortableColumnTypes.for(db.dialect);
    await db.execute(Sql.raw(`ALTER TABLE ${TABLE} ADD COLUMN ${COLUMN} ${type.shortText}`));
  }
}
