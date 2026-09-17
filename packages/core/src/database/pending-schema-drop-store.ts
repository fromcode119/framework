import type { IPendingSchemaDrop } from '@core/database/interfaces/pending-schema-drop.interface';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * Where a proposed column DROP is remembered between boots.
 *
 * Stored rather than recomputed because the proposal is a conversation with a human: the sweep
 * notices an undeclared column, a person approves or rejects it later, and nothing may act in
 * between. A parse that fails returns null rather than throwing — a corrupt entry must not stop the
 * boot that would let somebody delete it.
 */
export class PendingSchemaDropStore {
  /** One row per proposal, under the platform's own `_system_meta` row. */
  static readonly KEY_PREFIX = 'schema_orphan:';
  constructor(private readonly db: any) {}

  async existing(table: string, column: string): Promise<IPendingSchemaDrop | null> {
    const row: any = await this.db.withPlatformAdmin(async () =>
      this.db.findOne(SystemConstants.TABLE.META, { key: PendingSchemaDropStore.keyFor(table, column) }),
    );
    return PendingSchemaDropStore.parse(row?.value);
  }

  /**
   * Written as the PLATFORM's row, never a tenant's.
   *
   * One plugin copy per platform and one shared schema, so a column cannot exist for one site and
   * not another: there is exactly one queue. `withPlatformAdmin` is what makes the write legal —
   * `_system_meta` refuses a tenant-less row unless the connection carries the platform marker.
   */
  async remember(entry: IPendingSchemaDrop): Promise<void> {
    const key = PendingSchemaDropStore.keyFor(entry.table, entry.column);
    const value = JSON.stringify(entry);

    await this.db.withPlatformAdmin(async () => {
      const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
      if (existing) {
        await this.db.update(SystemConstants.TABLE.META, { key }, { value });
        return;
      }
      await this.db.insert(SystemConstants.TABLE.META, {
        key,
        value,
        description: `Undeclared column awaiting a decision: ${entry.table}.${entry.column}`,
        group: 'Schema Reconciliation',
      });
    });
  }

  /** What the column held, in words, for the one permanent record of an irreversible act. */
  static describe(entry: IPendingSchemaDrop): string {
    if (entry.rows === undefined) {
      // Never silently "0": the counts being unavailable is itself what the record must say.
      return 'its contents could NOT be counted';
    }
    return `${entry.nonEmpty} of ${entry.rows} row(s) held a value (${entry.nonNull} non-null)`;
  }

  static keyFor(table: string, column: string): string {
    return `${PendingSchemaDropStore.KEY_PREFIX}${table}.${column}`;
  }

  static parse(value: unknown): IPendingSchemaDrop | null {
    try {
      const parsed = JSON.parse(String(value ?? ''));
      if (!parsed?.table || !parsed?.column) return null;
      return parsed as IPendingSchemaDrop;
    } catch {
      return null;
    }
  }

  async forgetOne(table: string, column: string): Promise<void> {
    await this.db.withPlatformAdmin(async () =>
      this.db.delete(SystemConstants.TABLE.META, { key: PendingSchemaDropStore.keyFor(table, column) }),
    );
  }
}
