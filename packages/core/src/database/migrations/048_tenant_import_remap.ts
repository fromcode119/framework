import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';
import { Logger } from '@core/logging';

/**
 * Keeps the old id → new id map an import builds, instead of discarding it when the import ends.
 *
 * `TenantIdRemap` already knows every id it reassigned — the executor holds one for the run and
 * `TenantRowInserter` rewrites each reference through it. Then the import returns and the map is
 * garbage. Nothing else ever sees it.
 *
 * That is affordable only while the reference catalog is complete, and twice it was not: a pointer
 * whose target table is named by a sibling column, and an id declared inside a `json` document, were
 * both invisible to the walk. Every row holding one kept a number that now belongs to a different
 * site's record. Neither bug could be repaired from the platform, because the one thing needed to
 * repair it — which old id became which new id — no longer existed anywhere.
 *
 * What was done instead is the argument for this table. The mapping was RECONSTRUCTED for one
 * tenant, out of band: match each archived row to its imported row on a natural key and `created_at`,
 * confirm the pair twice, emit 22,000 lines of literal SQL, rehearse it against a copy, and run it by
 * hand against production. It worked, and it is not a thing anyone should have to do again — it only
 * worked because those collections happened to carry natural keys, and a table without one could not
 * have been repaired at all.
 *
 * So the map is persisted per import. A reference missed by the catalog can then be re-pointed later
 * by replaying what the importer actually did, derived from the import rather than reconstructed
 * from guesses about it.
 *
 * SINCE MIGRATION 049 this covers much less ground, and that is the point. Most tables now key on
 * `(tenant_id, id)`, so an import keeps its ids and there is no map to record — `TenantIdRemapStore`
 * skips a table in "preserve" mode entirely. What remains is the tables 049 does not widen, which
 * still share one pool of numbers and still renumber when the ranges overlap. Those are exactly the
 * ones a missed reference could still strand, so they are exactly the ones worth recording.
 *
 * NOT a general audit log. It answers exactly one question — "this row says 7; which row is that
 * now?" — and it is scoped, indexed and pruned for that. `imported_at` carries the run so a tenant
 * imported twice keeps both answers in order, most recent last.
 */
export class TenantImportRemapMigration extends BaseMigration {
  readonly version = 48;
  readonly name = 'An import keeps the id map it built, so a missed reference can be re-pointed later';

  private static readonly TABLE = '_system_tenant_import_remap';
  private static readonly logger = new Logger({ namespace: 'TenantImportRemapMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const { TABLE, logger } = TenantImportRemapMigration;

    if (await this.tableExists(db, TABLE)) {
      logger.info(`${TABLE} already existed; leaving every recorded mapping as it is.`);
      return;
    }

    // `old_id` and `new_id` are TEXT in every dialect even though ids are usually integers: a
    // collection may key on a uuid or a slug, and the remap itself stores strings for that reason
    // (`TenantIdRemap` maps String to String). Widening later would mean rewriting rows; starting
    // wide costs nothing here, because these columns are compared for equality and never summed.
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS ${TABLE} (
            tenant_id    TEXT        NOT NULL,
            table_name   TEXT        NOT NULL,
            old_id       TEXT        NOT NULL,
            new_id       TEXT        NOT NULL,
            imported_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`));
      },
      sqlite: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS ${TABLE} (
            tenant_id    TEXT NOT NULL,
            table_name   TEXT NOT NULL,
            old_id       TEXT NOT NULL,
            new_id       TEXT NOT NULL,
            imported_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`));
      },
      mysql: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS ${TABLE} (
            tenant_id    VARCHAR(190) NOT NULL,
            table_name   VARCHAR(190) NOT NULL,
            old_id       VARCHAR(190) NOT NULL,
            new_id       VARCHAR(190) NOT NULL,
            imported_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`));
      },
    });

    // The only question this table is asked: "for this tenant and table, what did `old_id` become?"
    // Not unique — a tenant imported twice holds both runs, and `imported_at` orders them.
    await db.execute(sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_${TABLE}_lookup ON ${TABLE} (tenant_id, table_name, old_id)`,
    ));

    logger.info(`${TABLE} created; imports from here on keep the map they build.`);
  }

  /**
   * Dropping the table loses every recorded mapping, and nothing can rebuild it — that is the whole
   * point of keeping it. Said plainly rather than left for someone to discover on a rollback.
   */
  async down(db: IDatabaseManager): Promise<void> {
    TenantImportRemapMigration.logger.warn(
      `Dropping ${TenantImportRemapMigration.TABLE}. Every id mapping recorded by an import is lost `
      + 'with it, and no later import can reconstruct one.',
    );
    await db.execute(sql.raw(`DROP TABLE IF EXISTS ${TenantImportRemapMigration.TABLE}`));
  }

  /**
   * Presence, asked per dialect: SQLite has no `information_schema` to query.
   *
   * `executeForDialect` resolves to nothing, so the answer is captured in a local rather than
   * returned from the branch — the same shape migration 045 uses for the same reason.
   */
  private async tableExists(db: IDatabaseManager, table: string): Promise<boolean> {
    let present = false;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = TenantImportRemapMigration.hasRow(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.tables WHERE table_name = '${table}'`,
        )));
      },
      sqlite: async () => {
        present = TenantImportRemapMigration.hasRow(await db.execute(sql.raw(
          `SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='${table}'`,
        )));
      },
      mysql: async () => {
        // Scoped to this schema — `information_schema` spans every database on the server.
        present = TenantImportRemapMigration.hasRow(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.tables `
          + `WHERE table_schema = DATABASE() AND table_name = '${table}'`,
        )));
      },
    });

    return present;
  }

  /** A driver returns either an array of rows or an object carrying them; both mean the same thing. */
  private static hasRow(result: any): boolean {
    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    return rows.length > 0;
  }
}
