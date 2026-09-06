/**
 * The one place tenant provisioning turns names into SQL.
 *
 * Every table and column name that reaches a statement here passes `identifier()` first: the names
 * come from the platform's own catalog, but an unvalidated identifier joined into SQL is how
 * injection happens, so the check sits where the SQL is built rather than being assumed upstream.
 * Values are NEVER interpolated — they travel as parameters.
 */
export class TenantSql {
  private static readonly IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

  static identifier(name: string): string {
    const value = String(name ?? '').trim();
    if (!TenantSql.IDENTIFIER.test(value)) {
      throw new Error(`TenantSql: "${value}" is not a safe SQL identifier.`);
    }
    return `"${value}"`;
  }

  static identifiers(names: string[]): string {
    return names.map((name) => TenantSql.identifier(name)).join(', ');
  }

  /** `$1, $2, …` for `count` values, starting at `from` (1-based). */
  static placeholders(count: number, from = 1): string {
    return Array.from({ length: count }, (_, index) => `$${from + index}`).join(', ');
  }

  static selectTenantRows(table: string, tenantColumn: boolean, orderBy: string | null, limit: number, offset: number): string {
    const where = tenantColumn ? `WHERE ${TenantSql.identifier('tenant_id')} = $1 ` : '';
    const order = orderBy ? `ORDER BY ${TenantSql.identifier(orderBy)} ` : '';
    return `SELECT * FROM ${TenantSql.identifier(table)} ${where}${order}LIMIT ${Math.max(1, limit)} OFFSET ${Math.max(0, offset)}`;
  }

  /** Rows of a SINGLE-TENANT source: no tenant column, or a tenant column nobody has stamped yet. */
  static selectUnassignedRows(table: string, tenantColumn: boolean, orderBy: string | null, limit: number, offset: number): string {
    const where = tenantColumn ? `WHERE ${TenantSql.identifier('tenant_id')} IS NULL ` : '';
    const order = orderBy ? `ORDER BY ${TenantSql.identifier(orderBy)} ` : '';
    return `SELECT * FROM ${TenantSql.identifier(table)} ${where}${order}LIMIT ${Math.max(1, limit)} OFFSET ${Math.max(0, offset)}`;
  }

  static insert(table: string, columns: string[]): string {
    return `INSERT INTO ${TenantSql.identifier(table)} (${TenantSql.identifiers(columns)}) VALUES (${TenantSql.placeholders(columns.length)})`;
  }

  static deleteTenantRows(table: string): string {
    return `DELETE FROM ${TenantSql.identifier(table)} WHERE ${TenantSql.identifier('tenant_id')} = $1`;
  }

  static countTenantRows(table: string): string {
    return `SELECT count(*)::int AS "count" FROM ${TenantSql.identifier(table)} WHERE ${TenantSql.identifier('tenant_id')} = $1`;
  }

  static updateColumn(table: string, column: string, idColumn: string): string {
    return `UPDATE ${TenantSql.identifier(table)} SET ${TenantSql.identifier(column)} = $1 WHERE ${TenantSql.identifier(idColumn)} = $2`;
  }

  /** `nextval` `count` times — the ids an import allocates for rows whose own ids are taken. */
  static allocateIds(sequence: string): string {
    return `SELECT nextval(${TenantSql.sequenceLiteral(sequence)})::bigint AS "id" FROM generate_series(1, $1)`;
  }

  static sequenceState(sequence: string): string {
    return `SELECT last_value::bigint AS "last_value", is_called FROM ${TenantSql.qualifiedSequence(sequence)}`;
  }

  static advanceSequence(sequence: string): string {
    return `SELECT setval(${TenantSql.sequenceLiteral(sequence)}, GREATEST((SELECT last_value FROM ${TenantSql.qualifiedSequence(sequence)}), $1::bigint), true)`;
  }

  /** `'"name"'` — a sequence name as the regclass LITERAL `nextval`/`setval` take. */
  private static sequenceLiteral(sequence: string): string {
    return `'${TenantSql.identifier(sequence)}'`;
  }

  private static qualifiedSequence(sequence: string): string {
    return TenantSql.identifier(sequence);
  }
}
