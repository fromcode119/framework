import type { IDatabaseManager } from '@fromcode119/database';
import { Logger } from '@core/logging';
import { SystemConstants } from '@core/constants/system.constants';
import { TenantMode } from '@core/tenant/tenant-mode';
import { RequestContextUtils } from '@core/context/request-context';
import type { IEntitySchemaPlan } from '@core/database/interfaces/entity-schema-plan.interface';
import type { IPendingSchemaDrop } from '@core/database/interfaces/pending-schema-drop.interface';
import { PendingSchemaDropStore } from '@core/database/pending-schema-drop-store';

/**
 * The CONTRACT half of expand/contract, which this framework has never had.
 *
 * A plugin update adds or renames a column and never drops the old one, so the debt accumulates
 * invisibly: 58 undeclared columns and 4 orphan tables on one production database, catalogued by
 * hand a month before this was written and every one of them still there. `syncCollection` computed
 * that diff all along and threw half of it away — it returned only the columns to ADD.
 *
 * WHY THIS PROPOSES RATHER THAN ACTS. Dropping a column is irreversible and the right answer is not
 * derivable from the schema. `invoice_date` duplicated `created_at` and was safe to drop;
 * `products.weight_kg` had moved into `dimensions.weight` and was not; `fcp_acme_carts.token`
 * is undeclared, non-null on every row, and a live capability secret. A reaper that dropped empty
 * columns would have taken `token` on a fresh site, where it is empty at exactly the moment anything
 * looked. So this records what it found, with the row counts beside it, and a platform admin decides.
 *
 * The owner's objection to the alternative stands and is why this is not a report: "a CLI that
 * reports seems stupid, nothing will fix". The queue lives in the admin, attached to a deploy, with
 * the evidence next to it.
 */
export class SchemaReconciliationService {
  private static readonly logger = new Logger({ namespace: 'schema-reconciliation' });


  private readonly drops: PendingSchemaDropStore;

  constructor(private readonly db: IDatabaseManager) {
    this.drops = new PendingSchemaDropStore(db);
  }

  /**
   * Record what this table has that nothing declares.
   *
   * Nothing is dropped here, ever. Counting is the delicate part — see `countAcrossTenants`.
   */
  async record(plan: IEntitySchemaPlan, inactivePlugins: string[] = []): Promise<void> {
    try {
      await this.scan(plan, inactivePlugins);
    } catch (error: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
      // NEVER breaks a boot. This is a diagnostic that proposes work; a deployment whose schema
      // audit fails must still come up and serve. The worst outcome here is a missing proposal.
      SchemaReconciliationService.logger.warn(
        `Could not record undeclared columns for ${plan.tableName}: ${error?.message || error}`,
      );
    }
  }

  private async scan(plan: IEntitySchemaPlan, inactivePlugins: string[]): Promise<void> {
    if (plan.undeclaredColumns.length === 0) return;

    for (const column of plan.undeclaredColumns) {
      await this.drops.remember({
        table: plan.tableName,
        column,
        firstSeenAt: (await this.drops.existing(plan.tableName, column))?.firstSeenAt || new Date().toISOString(),
        // Recorded per finding rather than globally: the queue outlives this boot, and an entry
        // approved months later must still carry the conditions it was found under.
        inactivePluginsAtScan: inactivePlugins,
      });
    }

    SchemaReconciliationService.logger.info(
      `${plan.tableName}: ${plan.undeclaredColumns.length} column(s) nothing declares `
      + `(${plan.undeclaredColumns.join(', ')}). Listed for review; nothing is dropped automatically.`,
    );
  }

  /**
   * Sum the column across EVERY tenant, or report nothing at all.
   *
   * FORCE row-level security applies to the table OWNER too, so a plain count from the boot
   * connection on a tenant-scoped table returns 0 for every column — a naive implementation reports
   * every isolated column as empty and invites an operator to drop live data.
   *
   * IT DOES NOT USE `PerTenantRun`, and both reasons are load-bearing:
   *
   *   - That helper iterates `listActive()`, which keeps only ACTIVE tenants and — because it is
   *     built from a host map — silently omits any tenant with no hosts at all. A suspended
   *     customer's 4,000 rows would count as zero, the operator would read "0 rows · no values",
   *     and `DROP COLUMN` is schema-wide. Their data would go with it.
   *   - It CATCHES per-tenant failures by design, so one tenant timing out mid-sweep would leave a
   *     partial sum presented as an authoritative total.
   *
   * So: every tenant in the table, and ANY failure means there is no trustworthy answer. A partial
   * count is worse than none, because nothing downstream can tell the two apart.
   */
  private async countAcrossTenants(
    table: string,
    column: string,
  ): Promise<{ rows: number; nonNull: number; nonEmpty: number; sample: string } | null> {
    if (!TenantMode.isEnabled()) {
      try {
        return await this.db.columnStats(table, column);
      } catch (error: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
        SchemaReconciliationService.logger.warn(`Could not count ${table}.${column}: ${error?.message || error}`);
        return null;
      }
    }

    const tenantIds = await this.everyTenantId();
    if (tenantIds.length === 0) return null;

    const total = { rows: 0, nonNull: 0, nonEmpty: 0, sample: '' };
    for (const tenantId of tenantIds) {
      try {
        const stats = await RequestContextUtils.storage.run(
          { tenantId },
          () => this.db.withTenant(tenantId, () => this.db.columnStats(table, column)),
        );
        total.rows += stats.rows;
        total.nonNull += stats.nonNull;
        total.nonEmpty += stats.nonEmpty;
        if (!total.sample && stats.sample) total.sample = stats.sample;
      } catch (error: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
        SchemaReconciliationService.logger.warn(
          `Could not count ${table}.${column} for tenant "${tenantId}": ${error?.message || error}. `
          + 'Reporting no counts rather than a partial total.',
        );
        return null;
      }
    }
    return total;
  }

  /**
   * EVERY tenant, whatever its state and whether or not it has a host.
   *
   * Read straight from the table rather than through the resolver: the resolver answers "who should
   * serve this request", which is a different and narrower question than "whose rows live in this
   * column".
   */
  private async everyTenantId(): Promise<string[]> {
    const rows = await this.db.withPlatformAdmin(async () =>
      this.db.find(SystemConstants.TABLE.TENANTS, { limit: 1000 }),
    );
    return (rows || []).map((row: any) => String(row?.id ?? '')).filter(Boolean);
  }

  /**
   * Everything awaiting a decision, COUNTED NOW.
   *
   * Counting happens here rather than at boot for three reasons, and the third is the one that
   * matters: it is expensive, the numbers would be stale by the time anyone read them, and doing it
   * during schema sync meant opening tenant scopes there — which released pooled clients with the
   * platform marker cleared and broke the untenanted `_system_meta` write that follows. An operator
   * asking the question is exactly when the answer should be taken.
   */
  async pendingWithCounts(): Promise<IPendingSchemaDrop[]> {
    const entries = await this.pending();
    for (const entry of entries) {
      const counted = await this.countAcrossTenants(entry.table, entry.column);
      // Fail closed: no trustworthy count means no numbers shown, and the admin says so rather than
      // printing a zero that reads as "safe to drop".
      if (!counted) continue;
      entry.rows = counted.rows;
      entry.nonNull = counted.nonNull;
      entry.nonEmpty = counted.nonEmpty;
      entry.sample = counted.sample;
    }
    // Ordered by what is actually AT STAKE — non-empty, not non-null. A column that is `''` on every
    // row is non-null everywhere and holds nothing; sorting by non-null put the safest drop first.
    // An uncounted entry sorts last rather than looking empty.
    return entries.sort((a, b) => (b.nonEmpty ?? -1) - (a.nonEmpty ?? -1));
  }

  /**
   * Drop recorded entries that this sweep did NOT find again.
   *
   * Without this the queue only ever grows, and a stale entry is not merely noise — it is the harm
   * this feature exists to prevent, deferred. Measured: an early build judged each table at its own
   * sync moment and recorded six SEO columns on a content plugin's pages table that a metadata plugin actively
   * declares. Once the detection was corrected they stopped being reported, but they SAT IN THE
   * QUEUE, where an operator would eventually have approved dropping a live column.
   *
   * Everything not found again is forgotten EXCEPT entries for a table whose audit FAILED — those
   * alone have no fresh answer, and forgetting them would discard real debt because one collection
   * happened to throw.
   *
   * Pruning an entry is always safe: it drops a PROPOSAL, never a column. An earlier version
   * inverted this and pruned only tables it had audited, which stranded every entry whose table the
   * sweep no longer sees at all — `media.shared` and `users.is_platform_admin` sat in the approval
   * queue with no path out, and both are live. A proposal that can never be re-validated must not be
   * left where someone can approve it; if the debt is real it is recorded again next sweep.
   */
  async prune(failedTables: Set<string>, foundKeys: Set<string>): Promise<void> {
    for (const entry of await this.pending()) {
      if (failedTables.has(entry.table)) continue;
      if (foundKeys.has(`${entry.table}.${entry.column}`)) continue;
      await this.drops.forgetOne(entry.table, entry.column);
      SchemaReconciliationService.logger.info(
        `${entry.table}.${entry.column} is declared again or already gone; removed from the review list.`,
      );
    }
  }

  /** The recorded queue, names only — no counting, no scopes. */
  async pending(): Promise<IPendingSchemaDrop[]> {
    const rows = await this.db.withPlatformAdmin(async () =>
      this.db.find(SystemConstants.TABLE.META, { where: { key: { startsWith: PendingSchemaDropStore.KEY_PREFIX } }, limit: 500 }),
    );
    return (rows || [])
      .map((row: any) => PendingSchemaDropStore.parse(row?.value))
      .filter((entry): entry is IPendingSchemaDrop => entry !== null);
  }

  /**
   * Drop one column a platform admin approved.
   *
   * REFUSES ANY NAME NOT CURRENTLY ON THE LIST. That is what stops this being a free-form DDL
   * endpoint: the only droppable things are ones this service itself proposed, from a real schema
   * diff, on this deployment.
   */
  async approve(table: string, column: string): Promise<IPendingSchemaDrop> {
    // COUNTED, not read from the queue. The stored entry carries no counts — they are taken when an
    // operator looks — so reading `pending()` here wrote "undefined of undefined row(s) held a
    // value" into the only permanent record of an irreversible drop.
    const entry = (await this.pendingWithCounts()).find((item) => item.table === table && item.column === column);
    if (!entry) {
      throw new Error(
        `${table}.${column} is not awaiting approval. Only a column this deployment actually found `
        + 'undeclared can be dropped here.',
      );
    }

    await this.db.withPlatformAdmin(async () => this.db.dropColumn(table, column));
    await this.drops.forgetOne(table, column);

    SchemaReconciliationService.logger.warn(
      `Dropped ${table}.${column} on approval — `
      + `${PendingSchemaDropStore.describe(entry)}. First seen ${entry.firstSeenAt}.`,
    );
    return entry;
  }


}