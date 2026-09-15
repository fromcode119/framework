/**
 * How much is actually in a column, for an operator deciding whether dropping it loses anything.
 *
 * `rows` and `nonNull` together are the question: a column non-null on every row is live data; one
 * that is null everywhere may still be a capability the code writes later. `sample` is there to be
 * RECOGNISED — seeing `2026-05-15 07:58:15` beside a new `issued_at` is what tells an operator the
 * two hold the same thing.
 */
export interface IColumnStats {
  rows: number;
  /** Rows where the column is not NULL. */
  nonNull: number;
  /**
   * Rows holding something that is not NULL and not blank.
   *
   * Reported separately because `count(col)` counts an empty string as a value: a column that is
   * `''` on every row is non-null everywhere and holds nothing. Presented as "15 of 15 rows held a
   * value" it reads as the most dangerous drop in the queue while being the safest.
   */
  nonEmpty: number;
  /** One value from the first non-empty row, truncated. Empty when the column holds none. */
  sample: string;
}
