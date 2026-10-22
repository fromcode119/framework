import type { IIndexNegatedValue } from './index-negated-value.interface';

/**
 * The rows a PARTIAL index covers: field -> a literal (equals), `null` (IS NULL) or `{ not: … }`.
 * Every entry must hold. Rendered by the database layer from checked identifiers and escaped literals.
 */
export interface IIndexWhere {
  [field: string]: string | number | boolean | null | IIndexNegatedValue;
}
