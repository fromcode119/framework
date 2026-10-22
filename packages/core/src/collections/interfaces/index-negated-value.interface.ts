/** `{ not: value }` — the rows where the column is NOT that value (`{ not: null }` is IS NOT NULL). */
export interface IIndexNegatedValue {
  not: string | number | boolean | null;
}
