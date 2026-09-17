/**
 * Refuses anything that is not a plain SQL identifier, before it is interpolated into DDL.
 *
 * DDL cannot take parameters. `CREATE POLICY`, `ALTER TABLE` and a `DO $$` body all name their table
 * in the statement text, so the only defence available is checking the name and refusing outright —
 * there is no bind to fall back on.
 *
 * One class rather than one private method per caller: the check was already duplicated the moment a
 * second place needed it, and a validation rule with two copies is a rule with two behaviours the
 * day one of them is relaxed.
 */
export class SqlIdentifier {
  /** Unquoted-identifier shape. Deliberately narrower than Postgres allows — everything this
   *  codebase generates is a plain snake_case name, so anything else is a bug or an attack. */
  private static readonly IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

  /** A key or value safe to sit inside a quoted literal: no quote, no backslash, no whitespace. */
  private static readonly LITERAL = /^[A-Za-z0-9_.:-]+$/;

  static assert(name: string, by: string): string {
    const trimmed = String(name ?? '').trim();
    if (!SqlIdentifier.IDENTIFIER.test(trimmed)) {
      throw new Error(`${by}: "${trimmed}" is not a plain SQL identifier; refusing to build DDL.`);
    }
    return trimmed;
  }

  /**
   * A LITERAL, not an identifier — a settings key may hold `.` or `-`, so it cannot go through
   * `assert`, and interpolating it unchecked would make the registry a SQL-injection surface the
   * moment a key ever becomes dynamic.
   */
  static assertLiteral(value: string, by: string): string {
    const trimmed = String(value ?? '').trim();
    if (!SqlIdentifier.LITERAL.test(trimmed)) {
      throw new Error(`${by}: "${trimmed}" is not a safe policy literal; refusing to build DDL.`);
    }
    return trimmed;
  }
}
