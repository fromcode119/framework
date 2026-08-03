import type { ICandidateLookupOptions } from '@core/interfaces/candidate-lookup-options.interface';

/**
 * Candidate lookup, plus the two knobs an upsert needs on top of it.
 *
 * An `interface extends` rather than the `ICandidateLookupOptions & { … }` intersection alias it replaced:
 * the extension is exactly what `extends` means, and it keeps the shape a declaration instead of a
 * type-level expression.
 */
export interface IUpsertByCandidatesOptions extends ICandidateLookupOptions {
  /** Primary-key field name; defaults to the collection's own id field. */
  idField?: string;

  /** Narrows the UPDATE arm — given the matched record, return the WHERE filter to apply. */
  updateWhere?: (record: Record<string, unknown>) => Record<string, unknown>;
}
