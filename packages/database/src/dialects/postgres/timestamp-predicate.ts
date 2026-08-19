/**
 * PostgresTimestampPredicate - the column expression for (in)equality against a JS Date operand.
 *
 * Postgres stores TIMESTAMP columns with MICROSECOND precision (`DEFAULT CURRENT_TIMESTAMP` always
 * produces one), but the pg driver parses a timestamp into a JS Date, which can only carry
 * MILLISECONDS — the driver TRUNCATES the sub-millisecond digits (verified live: a stored `.123999`
 * reads back as `.123`). A read-modify-write that binds the read-back Date into `col = $n` can
 * therefore never match such a row again: the optimistic-lock pattern (`update(table, { id,
 * updatedAt }, …)`) reported a concurrent modification on EVERY write to a row whose timestamp
 * carried sub-millisecond digits. Truncating the COLUMN to the same precision the driver hands back
 * makes equality mean "the same instant, at the precision a JS Date can express" — a genuinely
 * stale Date still matches nothing, so the lock keeps protecting.
 */
export class PostgresTimestampPredicate {
  static equalityColumn(quotedColumn: string, value: unknown): string {
    if (value instanceof Date) return `date_trunc('milliseconds', ${quotedColumn})`;
    return quotedColumn;
  }
}
