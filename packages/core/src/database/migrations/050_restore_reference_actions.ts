import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';
import { Logger } from '@core/logging';

/**
 * Puts back the ON DELETE actions that an earlier version of migration 049 dropped.
 *
 * 049 rebuilds five references so they can point at a widened key. For a short window it rebuilt them
 * BARE — reading `pg_get_constraintdef` and writing a plain `FOREIGN KEY ... REFERENCES ...` — which
 * silently removed what each one does when its parent row goes away. Four cascade and one nulls the
 * reference, so on a database that ran that version, deleting a person stopped removing their
 * addresses and started being REFUSED, and deleting a media folder stopped unfiling its media.
 *
 * 049 no longer does that: it reads the actions from the catalog before dropping and re-applies them.
 * But a database that already ran the earlier version has 049 recorded and will never re-run it, so
 * the repair has to be its own migration. This is that repair, and it belongs in the repository rather
 * than in a command somebody remembers to run, because the broken version reached `main`.
 *
 * IDEMPOTENT AND SELF-LIMITING. It only touches a reference whose action is missing, so on any
 * deployment that ran the corrected 049 — or has not run 049 at all — it finds nothing and does
 * nothing. It never removes an action and never changes one that is already set, so a deployment that
 * deliberately chose different actions keeps them.
 */
export class RestoreReferenceActionsMigration extends BaseMigration {
  readonly version = 50;
  readonly name = 'Put back the ON DELETE actions an earlier migration dropped';

  private static readonly logger = new Logger({ namespace: 'RestoreReferenceActionsMigration' });

  /**
   * What each reference does when its parent row is deleted — the values every deployment of this
   * platform has had since the tables were created, and the ones 049 briefly discarded.
   *
   * Written down HERE, unlike in 049, because there is nothing left to read them from: on an affected
   * database the action is already gone. This is a repair to a known state, not a general rule.
   */
  private static readonly EXPECTED = [
    { constraint: 'media_folder_id_fkey', child: 'media', column: 'folder_id', parent: 'media_folders', action: 'SET NULL' },
    { constraint: 'media_folders_parent_id_fkey', child: 'media_folders', column: 'parent_id', parent: 'media_folders', action: 'CASCADE' },
    { constraint: 'people_addresses_person_id_fkey', child: 'people_addresses', column: 'person_id', parent: 'people', action: 'CASCADE' },
    { constraint: 'person_relationships_to_person_id_fkey', child: 'person_relationships', column: 'to_person_id', parent: 'people', action: 'CASCADE' },
    { constraint: 'person_relationships_from_person_id_fkey', child: 'person_relationships', column: 'from_person_id', parent: 'people', action: 'CASCADE' },
  ] as const;

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => RestoreReferenceActionsMigration.restore(db),

      // Neither dialect runs the migration this repairs: 049 is a no-op on both, so there is nothing
      // here that could have lost an action.
      sqlite: async () => undefined,
      mysql: async () => undefined,
    });
  }

  /**
   * Narrowing this back would mean deliberately removing a referential action, which is the damage
   * rather than the undo. Nothing to do.
   */
  async down(): Promise<void> {
    RestoreReferenceActionsMigration.logger.info(
      'Nothing to roll back: this only restores actions that were missing, and removing one again '
      + 'would reintroduce the fault it repairs.',
    );
  }

  private static async restore(db: IDatabaseManager): Promise<void> {
    const { logger } = RestoreReferenceActionsMigration;
    const repaired: string[] = [];

    for (const ref of RestoreReferenceActionsMigration.EXPECTED) {
      const present = await RestoreReferenceActionsMigration.current(db, ref.constraint);

      // Absent entirely (this deployment has not run 049, or does not have these tables) or already
      // carrying an action — either way there is nothing to repair.
      if (present === null || present !== 'a') continue;

      // The parent may or may not have been widened, so the reference is rebuilt in the shape it is
      // already in — read from the catalog — with only the missing action added.
      const columns = await RestoreReferenceActionsMigration.keyColumns(db, ref.constraint);
      await db.execute(sql.raw(
        `ALTER TABLE ${ref.child} DROP CONSTRAINT ${ref.constraint}, `
        + `ADD CONSTRAINT ${ref.constraint} FOREIGN KEY (${columns.child}) `
        + `REFERENCES ${ref.parent} (${columns.parent}) ON DELETE ${ref.action}`,
      ));
      repaired.push(`${ref.constraint} (ON DELETE ${ref.action})`);
    }

    if (!repaired.length) {
      logger.info('Every reference already says what it does on delete; nothing to repair.');
      return;
    }

    logger.warn(
      `Restored the delete behaviour of ${repaired.length} reference(s): ${repaired.join(', ')}. `
      + 'They had been rebuilt without it, which turned a cascading delete into a refusal.',
    );
  }

  /**
   * The constraint's delete action as Postgres records it, or `null` when the constraint is not there.
   *
   * `'a'` is NO ACTION, which is what a reference rebuilt bare ends up with — and what this repairs.
   */
  private static async current(db: IDatabaseManager, constraint: string): Promise<string | null> {
    const rows = await db.queryRaw(
      `SELECT confdeltype::text AS del FROM pg_constraint WHERE contype = 'f' AND conname = '${constraint}' LIMIT 1`,
    );
    return rows.length ? String(rows[0].del) : null;
  }

  /**
   * The columns the reference is currently written over, on both sides.
   *
   * Read rather than assumed: whether it is `(folder_id) -> (id)` or `(tenant_id, folder_id) ->
   * (tenant_id, id)` depends on whether 049 widened that parent, which depends on the database.
   */
  private static async keyColumns(db: IDatabaseManager, constraint: string): Promise<{ child: string; parent: string }> {
    const rows = await db.queryRaw(
      `SELECT
         (SELECT string_agg(a.attname, ', ' ORDER BY x.ord)
            FROM unnest(c.conkey) WITH ORDINALITY AS x(att, ord)
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.att) AS child,
         (SELECT string_agg(a.attname, ', ' ORDER BY x.ord)
            FROM unnest(c.confkey) WITH ORDINALITY AS x(att, ord)
            JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = x.att) AS parent
       FROM pg_constraint c WHERE c.contype = 'f' AND c.conname = '${constraint}' LIMIT 1`,
    );
    return { child: String(rows[0]?.child ?? ''), parent: String(rows[0]?.parent ?? '') };
  }
}
