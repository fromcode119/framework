import type { IEntitySchemaPlan } from '@core/database/interfaces/entity-schema-plan.interface';
import type { IDeclaredIndex } from '@core/database/interfaces/declared-index.interface';
import { TenantMode } from '@core/tenant/tenant-mode';
import { TenantScopedTables } from '@core/database/tenant-scoped-tables';
import type { Logger } from '@core/logging';
import type { IDatabaseManager } from '@fromcode119/database';
import { AggregateFunction, SortDirection, TenantColumn } from '@fromcode119/database';

/**
 * Creates the indexes a collection declares on its own table.
 *
 * `indexes` was fingerprinted and then ignored: a plugin declared `unique: true` over
 * `(user_id, lesson_id)` and the database never enforced it. `createIndexIfMissing` is the
 * dialect-portable, idempotent form (the one migrations use), so re-running a sync is free. No
 * `database:schema` capability is involved — that gate exists for raw DDL in a migration, and a
 * declaration can only ever name the collection's own columns.
 *
 * A UNIQUE index on a shared table is per site. Where the table is tenant-scoped and the deployment
 * has tenants, it is created as `(tenant_id, cols…)`. A deployment with no tenants gets the plain
 * `(cols…)` form, and the isolation sweep rewrites it to the tenant-led form (partial predicate
 * kept) the first time a tenant exists, so the two states converge on one shape.
 *
 * REPORTS RATHER THAN THROWS. A unique over rows that already hold duplicates cannot be built;
 * refusing to sync the plugin over it is worse than saying so. That one index is skipped, the
 * conflicting key groups are logged, and no row is deleted or changed — resolving them is the
 * operator's call, and the next sync builds the index on its own.
 */
export class DeclaredIndexEnsurer {
  /** How many conflicting key groups a log line spells out; the total is always stated. */
  private static readonly REPORTED_GROUPS = 10;

  constructor(
    private readonly db: IDatabaseManager,
    private readonly logger: Logger,
  ) {}

  async ensure(plan: IEntitySchemaPlan, options: { system?: boolean } = {}): Promise<void> {
    if (plan.declaredIndexes.length === 0) return;
    const scoped = this.isTenantLed(plan.tableName, options);

    if (scoped && plan.declaredIndexes.some((index) => index.unique)) {
      // The column must exist before an index can lead with it; adding it is idempotent and is what
      // the isolation step does next anyway.
      await this.db.tenantIsolation.addTenantColumn(plan.tableName);
    }

    for (const index of plan.declaredIndexes) {
      await this.createOne(plan.tableName, index, scoped);
    }
  }

  private isTenantLed(table: string, options: { system?: boolean }): boolean {
    return this.db.supportsTenantIsolation()
      && TenantMode.isEnabled()
      && TenantScopedTables.isTenantScoped(table, options);
  }

  private async createOne(table: string, index: IDeclaredIndex, scoped: boolean): Promise<void> {
    const led = scoped && index.unique && !index.columns.includes(TenantColumn.NAME);
    const columns = led ? [TenantColumn.NAME, ...index.columns] : index.columns;
    const label = `${index.unique ? 'UNIQUE ' : ''}${index.where ? 'partial ' : ''}index "${index.name}" on ${table} (${columns.join(', ')})`;

    try {
      await this.db.createIndexIfMissing(table, index.name, columns, { unique: index.unique, where: index.where });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (!index.unique) {
        this.logger.warn(`Could not create the declared ${label}: ${reason}.`);
        return;
      }
      this.logger.warn(await this.describeUniqueFailure(table, index, columns, scoped, label, reason));
    }
  }

  /** What a refused unique says: the groups that collide, found by asking the data, or the raw reason. */
  private async describeUniqueFailure(
    table: string, index: IDeclaredIndex, columns: string[], scoped: boolean, label: string, reason: string,
  ): Promise<string> {
    const head = `The declared ${label} was NOT created and is skipped: ${reason}.`;
    const tail = ' No row was changed. Resolve the duplicates and the next sync creates it; until then uniqueness is not enforced.';
    try {
      const groups = await this.duplicateGroups(table, index, columns, scoped);
      if (groups.length === 0) return head + tail;
      const shown = groups.slice(0, DeclaredIndexEnsurer.REPORTED_GROUPS)
        .map((group) => `(${columns.map((column) => `${column}=${String(group.key[column])}`).join(', ')}) x${group.copies}`);
      const more = groups.length > shown.length ? ` ... and ${groups.length - shown.length} more` : '';
      return `${head} ${groups.length} key group(s) hold duplicate rows: ${shown.join('; ')}${more}.${tail}`;
    } catch (diagnosis) {
      return `${head} (the duplicate groups could not be listed: ${diagnosis instanceof Error ? diagnosis.message : String(diagnosis)}).${tail}`;
    }
  }

  /** Keys carried by more than one row. A NULL in any column is never a duplicate: uniques treat NULLs as distinct. */
  private async duplicateGroups(
    table: string, index: IDeclaredIndex, columns: string[], scoped: boolean,
  ): Promise<Array<{ key: Record<string, unknown>; copies: number }>> {
    const read = () => this.db.aggregate(table, {
      where: DeclaredIndexEnsurer.filterOf(index),
      groupBy: columns,
      measures: [{ fn: AggregateFunction.COUNT, as: 'copies' }],
      orderBy: { by: 'copies', direction: SortDirection.DESC },
      limit: 500,
    });
    // On a site-isolated table the owner connection sees no row at all unless isolation is lifted for
    // the length of the read — and a clean-looking empty answer would be a lie.
    const rows = scoped ? await this.db.tenantIsolation.readAsOwner(table, read) : await read();

    return rows
      .filter((row) => Number(row.copies) > 1 && columns.every((column) => row[column] !== null && row[column] !== undefined))
      .map((row) => ({ key: row, copies: Number(row.copies) }));
  }

  /** The partial index's condition as a `where` filter, so the diagnosis counts only the rows the index covers. */
  private static filterOf(index: IDeclaredIndex): Record<string, unknown> | undefined {
    if (!index.where) return undefined;
    return Object.fromEntries(index.where.map((condition) => [
      condition.column,
      condition.negate ? { ne: condition.value } : condition.value,
    ]));
  }
}
