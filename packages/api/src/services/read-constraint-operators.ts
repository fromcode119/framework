import { Sql, type IDatabaseManager } from '@fromcode119/database';

/**
 * The comparisons a collection's `access.read` rule may use besides an exact value. A rule could only
 * say `field = value`, so "not hidden", "no longer scheduled" and "not switched off" could not be stated
 * and those rows went to every visitor:
 *
 *   { visibility: { $ne: 'hidden' } }                    — anything but this value (an unset field passes)
 *   { publishAt: { $lte: nowIso, $orNull: true } }       — on or before this value, or unset
 *
 * Only a READ RULE's values are read this way; a visitor's query string never is.
 */
export class ReadConstraintOperators {
  private static readonly KEYS = new Set(['$ne', '$lte', '$orNull']);

  static isOperator(value: unknown): value is { $ne?: unknown; $lte?: unknown; $orNull?: boolean } {
    if (!value || Object(value) !== value || Array.isArray(value) || value instanceof Date) return false;
    const keys = Object.keys(value as object);
    return keys.length > 0 && keys.every((key) => ReadConstraintOperators.KEYS.has(key))
      && ('$ne' in (value as object) || '$lte' in (value as object));
  }

  /** The rule's exact values, and its comparisons, apart. */
  static split(constraints: Record<string, unknown>): { equalities: Record<string, unknown>; operators: Record<string, unknown> } {
    const equalities: Record<string, unknown> = {};
    const operators: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(constraints)) {
      (ReadConstraintOperators.isOperator(value) ? operators : equalities)[key] = value;
    }
    return { equalities, operators };
  }

  /** The comparisons as one WHERE clause over `table`; a field the table does not have matches nothing. */
  static buildClause(db: IDatabaseManager, table: any, operators: Record<string, unknown>): unknown {
    const chunks = Object.entries(operators).map(([key, value]) => {
      const column = table[key];
      if (!column) return Sql.query`1 = 0`;
      const op = value as { $ne?: unknown; $lte?: unknown; $orNull?: boolean };
      if ('$ne' in op) return Sql.query`${column} IS DISTINCT FROM ${op.$ne as any}`;
      return op.$orNull
        ? Sql.query`(${column} IS NULL OR ${column} <= ${op.$lte as any})`
        : Sql.query`${column} <= ${op.$lte as any}`;
    });
    if (chunks.length === 0) return undefined;
    return chunks.length === 1 ? chunks[0] : db.and(...(chunks as any[]));
  }

  /** The same comparison on one record already read — a single-record read checks the rule this way. */
  static matches(actual: unknown, value: { $ne?: unknown; $lte?: unknown; $orNull?: boolean }): boolean {
    if ('$ne' in value) return actual !== value.$ne;
    if (actual === null || actual === undefined || actual === '') return value.$orNull === true;
    const left = new Date(actual as string | number | Date).getTime();
    const right = new Date(value.$lte as string | number | Date).getTime();
    if (!Number.isNaN(left) && !Number.isNaN(right)) return left <= right;
    return String(actual) <= String(value.$lte);
  }
}
