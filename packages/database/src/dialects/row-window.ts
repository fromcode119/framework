/**
 * `LIMIT` / `OFFSET` for the raw statements that write them into the SQL text.
 *
 * Those two are the only caller values the raw find paths place in the statement as TEXT rather than
 * as a bound parameter, and they arrive from plugin code — for an isolated plugin, from another
 * process — typed as whatever it sent. `LIMIT ${limit}` with a string `limit` was an injection: a
 * plugin a site uploaded could append its own `UNION SELECT` past every table guard. Only a whole
 * number reaches the SQL now; anything else is refused before a statement is built.
 *
 * Unchanged for every caller that passed a number or a numeric string: 0 / absent still means "no
 * limit", and a fractional number is truncated, as `raw-statement-builder` already did.
 */
export class RowWindow {
  static clause(limit: unknown, offset: unknown): string {
    const take = RowWindow.count(limit, 'limit');
    const skip = RowWindow.count(offset, 'offset');
    return `${take ? ` LIMIT ${take}` : ''}${skip ? ` OFFSET ${skip}` : ''}`;
  }

  private static count(value: unknown, name: string): number {
    if (value === undefined || value === null || value === '' || value === false || value === 0) return 0;
    const number = typeof value === 'number'
      ? Math.trunc(value)
      : (typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value) : Number.NaN);
    if (!Number.isSafeInteger(number) || number < 0) {
      throw new Error(`Invalid ${name} ${JSON.stringify(value)}: a non-negative whole number is required.`);
    }
    return number;
  }
}
