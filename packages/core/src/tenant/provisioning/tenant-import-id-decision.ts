import type { IDatabaseManager } from '@fromcode119/database';
import { TenantImportIdBasis } from '@core/tenant/provisioning/enums/tenant-import-id-basis.enum';
import { TenantImportIdMode } from '@core/tenant/provisioning/enums/tenant-import-id-mode.enum';
import { TenantArchiveReader } from '@core/tenant/provisioning/tenant-archive-reader';
import { TenantSql } from '@core/tenant/provisioning/tenant-sql';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';
import type { ITenantImportIdDecision } from '@core/tenant/provisioning/interfaces/tenant-import-id-decision.interface';

/**
 * Whether an import may keep the ids its archive arrives with, per table.
 *
 * An archive used not to be able to keep them: every site's rows shared one table keyed on `id`
 * alone, so an incoming order 157 collided with whoever already held 157, and the only way in was to
 * hand out fresh numbers and rewrite every reference that pointed at the old ones.
 *
 * Renumbering was never the goal; it was the price of the shared key, and an expensive one. The
 * rewrite it forces is correct only while the catalog of references is complete, and twice it was
 * not — a pointer whose target table is named by a sibling column, and an id declared inside a `json`
 * document. Rows kept numbers belonging to another site's records, and putting them right meant
 * reconstructing, by hand and out of band, a mapping the importer had computed and thrown away.
 *
 * Migration 049 widens the key to `(tenant_id, id)`, which removes the collision and with it the
 * reason to renumber. It does not widen everything — the set is derived from the schema — so this
 * asks the database which shape each table is actually in, rather than assuming the migration
 * covered it.
 *
 * Both the PREVIEW and the RUN come through here, so what an operator was shown is what happens.
 */
export class TenantImportIdDecision {
  /**
   * Cached for the life of the process, which is safe for a narrow reason: only a MIGRATION changes a
   * table's primary key, and migrations run at boot before anything can import. The planner asks once
   * per table and the executor asks again for the same table, so preview and execution read the same
   * answer — the property those two re-deriving the decision depends on.
   */
  private static readonly perTenantKey = new Map<string, boolean>();

  /**
   * `taken` and `minId` are measured even where they no longer decide anything: they are what an
   * operator is shown about the ids arriving, and a number that stops being gathered is a number
   * nobody notices going wrong.
   *
   * Whatever is decided, the executor advances the sequence past the highest imported id afterwards.
   * That matters MORE here, not less: preserved ids sit wherever the source left them, and a row
   * created after the import must not be handed one of them.
   */
  static async decide(db: IDatabaseManager, table: TenantTableDescriptor, reader: TenantArchiveReader): Promise<ITenantImportIdDecision> {
    const state = (await db.queryRaw(TenantSql.sequenceState(table.idSequence as string)))[0] ?? {};

    // A sequence that has never been called holds `last_value = 1` and `is_called = false` — it has
    // handed out NOTHING. Reading that 1 as "one id taken" would renumber an archive starting at 1
    // against an empty platform.
    const taken = state.is_called === true || state.is_called === 't' ? Number(state.last_value ?? 0) : 0;

    let minId: number | null = null;
    for await (const row of reader.rows(table.name)) {
      const id = Number(row.id);
      if (Number.isFinite(id) && (minId === null || id < minId)) minId = id;
    }

    if (minId === null) return TenantImportIdDecision.keep(TenantImportIdBasis.EMPTY, taken, minId);

    if (await TenantImportIdDecision.keysPerTenant(db, table.name)) {
      return TenantImportIdDecision.keep(TenantImportIdBasis.PER_TENANT_KEY, taken, minId);
    }

    // The key here is still `id` alone, so the numbers are shared with every other site and the old
    // rule applies unchanged: an archive that starts above what this platform has handed out cannot
    // collide and is let through; anything else has to be renumbered.
    if (minId > taken) return TenantImportIdDecision.keep(TenantImportIdBasis.ABOVE_SEQUENCE, taken, minId);

    return {
      mode: TenantImportIdMode.REMAP,
      basis: String(TenantImportIdBasis.BELOW_SEQUENCE.value),
      taken,
      minId,
    };
  }

  private static keep(basis: TenantImportIdBasis, taken: number, minId: number | null): ITenantImportIdDecision {
    return { mode: TenantImportIdMode.PRESERVE, basis: String(basis.value), taken, minId };
  }

  /**
   * Whether this table gives each site its own id space, asked of the LIVE schema.
   *
   * Not assumed from migration 049 having run. It widens the tables that are tenant-scoped AND carry
   * row-level security, which is most of them and not all of them — and a table it left alone still
   * shares one pool of numbers, where keeping the archive's ids would write this site's rows over
   * another site's. Reading the schema is what keeps the two paths honest about which one a table is
   * on.
   */
  private static async keysPerTenant(db: IDatabaseManager, table: string): Promise<boolean> {
    // A driver with no tenant isolation has no second site to collide with, so the question does not
    // arise — and asking anyway would REFUSE rather than answer, which is the point of that default.
    if (!db.supportsTenantIsolation()) return false;

    const known = TenantImportIdDecision.perTenantKey.get(table);
    if (known !== undefined) return known;

    const keyed = await db.tenantIsolation.keysPerTenant(table);
    TenantImportIdDecision.perTenantKey.set(table, keyed);
    return keyed;
  }
}
