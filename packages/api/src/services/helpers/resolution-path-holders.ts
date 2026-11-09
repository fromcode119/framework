import { Sql } from '@fromcode119/database';
import type { ICollection } from '@fromcode119/core';
import { QueryHelper } from '@api/services/query-helper';
import type { IResolutionLookup } from '@api/services/helpers/interfaces/resolution-lookup.interface';

/**
 * Which collections hold a row for a path, asked in ONE statement per batch instead of one query per collection.
 *
 * A site with a hundred collections used to ask each of them (an indexed `limit 1` read apiece, in windows):
 * fifteen rounds of connection and round trip for an answer that is "none" on most pages. Here every batch is
 * one `exists` per collection joined by `union all`, so the database answers it in one round trip. It asks the
 * same question — does any row hold one of the looked-up values — and only ever NARROWS: a collection it cannot
 * express (a field its table does not have) is reported as holding, as before, and the whole answer is `null`
 * when the statement could not be asked at all, so the caller asks each collection as it did.
 */
export class ResolutionPathHolders {
  /** Collections per statement: the database plans each one, so a very long statement costs more than it saves. */
  private static readonly BATCH = 54;

  constructor(private readonly db: any) {}

  /** The positions (in `candidates`) of the collections that may hold the path; `null` when the question could not be asked. */
  async which(candidates: Array<{ collection: ICollection; finds: IResolutionLookup[] }>): Promise<Set<number> | null> {
    try {
      const holding = new Set<number>();
      const batches: Array<Array<{ position: number; exists: unknown }>> = [];
      let batch: Array<{ position: number; exists: unknown }> = [];
      candidates.forEach((candidate, position) => {
        const exists = this.existsFor(candidate.collection, candidate.finds);
        if (exists === null) { holding.add(position); return; }
        batch.push({ position, exists });
        if (batch.length === ResolutionPathHolders.BATCH) { batches.push(batch); batch = []; }
      });
      if (batch.length) batches.push(batch);
      const answers = await Promise.all(batches.map(async (parts) => {
        const statement = Sql.join(parts.map((part) => Sql.query`select ${Sql.raw(String(part.position))} as position where ${part.exists}`), Sql.raw(' union all '));
        const result = await this.db.execute(statement);
        if (!Array.isArray(result?.rows)) throw new Error('the statement did not answer with rows');
        return result.rows as Array<{ position: unknown }>;
      }));
      for (const rows of answers) for (const row of rows) holding.add(Number(row.position));
      return holding;
    } catch {
      return null;
    }
  }

  /** `exists (…)` for the collection's lookups, or `null` when its table cannot answer them. */
  private existsFor(collection: ICollection, finds: IResolutionLookup[]): unknown | null {
    const table = QueryHelper.getVirtualTable(collection);
    const clauses = finds.flatMap((find) => (['customPermalink', 'slug'] as const)
      .filter((field) => find.query[field] !== undefined && table[field])
      .map((field) => Sql.eq(table[field], find.query[field])));
    if (clauses.length !== finds.length) return null;
    return Sql.query`exists (select 1 from ${table} where ${Sql.or(...clauses)})`;
  }
}
