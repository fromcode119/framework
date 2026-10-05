import { BaseMigration, IDatabaseManager, Sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';

/**
 * A source's "Publish builds to site", and what happened the last time it did.
 *
 * `publish_to_site` names the site each successful build is handed to (NULL = off); `last_publish`
 * is the outcome the Sources screen shows beside the build. Both NULL on every existing row, which
 * means "not publishing" — exactly what those sources did before.
 */
export class SourcesPublishToSiteMigration extends BaseMigration {
  readonly version = 61;
  readonly name = 'Sources publish to site';
  /** Two nullable columns the running release neither reads nor writes. */
  readonly rollingSafe = true;

  private static readonly TABLE = '_system_sources_builds';

  async up(db: IDatabaseManager): Promise<void> {
    const { TABLE } = SourcesPublishToSiteMigration;
    const columns = (await db.getColumns(TABLE)).map((name) => name.toLowerCase());
    // No columns at all means no table: there is nothing to add a column to (migrations 31/53 own it).
    if (!columns.length) return;
    const type = PortableColumnTypes.for(db.dialect);
    if (!columns.includes('publish_to_site')) {
      await db.execute(Sql.raw(`ALTER TABLE ${TABLE} ADD COLUMN publish_to_site ${type.shortText}`));
    }
    if (!columns.includes('last_publish')) {
      await db.execute(Sql.raw(`ALTER TABLE ${TABLE} ADD COLUMN last_publish TEXT`));
    }
  }
}
