import { sql, eq, and, desc, asc } from 'drizzle-orm';
import { normalizeParamValue, toSnakeCase } from '../naming-strategy';
import type { JoinClause } from '../types';

/**
 * BaseDialect - Shared utilities for database dialect implementations
 * 
 * Provides common helper methods used across Postgres, MySQL, and SQLite dialects.
 * This reduces code duplication while allowing each dialect to maintain its specific implementation.
 */
export abstract class BaseDialect {
  /**
   * Normalize parameter values for database queries
   * Handles undefined, null, Date, Buffer, and objects (JSON stringify)
   */
  protected normalizeParamValue(value: any): any {
    return normalizeParamValue(value);
  }

  /**
   * Build WHERE clause conditions from a plain object
   * Converts { id: 1, status: 'active' } into drizzle condition array
   */
  protected buildWhereConditions(where: any): any[] {
    if (typeof where !== 'object' || where === null) return [];
    if (Object.getPrototypeOf(where) !== Object.prototype) return [];

    return Object.entries(where).map(([k, v]) => 
      eq(sql`${sql.identifier(k)}`, v as any)
    );
  }

  /**
   * Build ORDER BY clause from various formats
   * Supports: string ("created_at desc"), object ({ created_at: 'desc' }), or drizzle expressions
   */
  protected buildOrderBy(orderBy: any): any {
    if (!orderBy) return null;

    // Array of drizzle expressions - pass through
    if (Array.isArray(orderBy)) {
      return orderBy;
    }

    // String format: "column_name desc"
    if (typeof orderBy === 'string') {
      const [column, direction] = orderBy.split(' ');
      const orderFn = direction?.toLowerCase() === 'desc' ? desc : asc;
      return [orderFn(sql.identifier(column))];
    }

    // Object format: { column_name: 'desc' }
    if (typeof orderBy === 'object' && Object.getPrototypeOf(orderBy) === Object.prototype) {
      return Object.entries(orderBy).map(([column, direction]) => {
        const orderFn = String(direction).toLowerCase() === 'desc' ? desc : asc;
        return orderFn(sql.identifier(column));
      });
    }

    // Drizzle expression - pass through
    return [orderBy];
  }

  /**
   * Build raw SQL WHERE clause for string-based queries
   * Returns SQL string and parameter values array
   */
  protected buildRawWhereClause(where: any): { sql: string; values: any[] } {
    if (!where || typeof where !== 'object' || Object.getPrototypeOf(where) !== Object.prototype) {
      return { sql: '', values: [] };
    }

    const whereColumns = Object.keys(where);
    if (whereColumns.length === 0) {
      return { sql: '', values: [] };
    }

    const conditions = whereColumns.map((column, index) => `"${column}" = $${index + 1}`);
    const values = whereColumns.map((column) => this.normalizeParamValue(where[column]));

    return {
      sql: ` WHERE ${conditions.join(' AND ')}`,
      values
    };
  }

  /**
   * Build raw SQL ORDER BY clause for string-based queries
   */
  protected buildRawOrderByClause(orderBy: any): string {
    if (!orderBy) return '';

    if (typeof orderBy === 'string') {
      return ` ORDER BY ${orderBy}`;
    }

    if (typeof orderBy === 'object' && !Array.isArray(orderBy)) {
      const clauses = Object.entries(orderBy)
        .map(([k, v]) => `"${k}" ${String(v).toUpperCase()}`)
        .join(', ');
      return ` ORDER BY ${clauses}`;
    }

    return '';
  }

  /**
   * Returns the SQL LIKE operator string for this dialect.
   * Postgres overrides this to return 'ILIKE' for case-insensitive matching.
   */
  protected getLikeOperator(): string {
    return 'LIKE';
  }

  /**
   * Build a combined WHERE clause from exact matches (where) and LIKE search (search).
   * Exact conditions are ANDed; search columns are OR-ed and ANDed with the rest.
   * Uses getParamPlaceholder() so it works across dialects.
   */
  protected buildRawFilterSQL(
    where: any,
    search?: { columns: string[]; value: string }
  ): { sql: string; values: any[] } {
    const conditions: string[] = [];
    const values: any[] = [];

    if (where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype) {
      for (const [column, value] of Object.entries(where)) {
        values.push(this.normalizeParamValue(value as any));
        conditions.push(`"${toSnakeCase(column)}" = ${this.getParamPlaceholder(values.length)}`);
      }
    }

    if (search && search.columns.length > 0 && search.value) {
      const pattern = `%${search.value}%`;
      const likeOp = this.getLikeOperator();
      const likeParts: string[] = [];
      for (const col of search.columns) {
        values.push(pattern);
        likeParts.push(`"${col}" ${likeOp} ${this.getParamPlaceholder(values.length)}`);
      }
      conditions.push(`(${likeParts.join(' OR ')})`);
    }

    if (conditions.length === 0) return { sql: '', values: [] };
    return { sql: ` WHERE ${conditions.join(' AND ')}`, values };
  }

  // ─── Join support ────────────────────────────────────────────────────────────

  /**
   * Returns the SQL parameter placeholder for the given 1-based index.
   * Override in dialects that use positional placeholders ($1, $2 …).
   */
  protected getParamPlaceholder(_index: number): string {
    return '?';
  }

  /**
   * Execute a raw SELECT string against the underlying connection.
   * Must be overridden by each concrete dialect.
   */
  protected async executeRawSelect(_sql: string, _values: any[]): Promise<any[]> {
    throw new Error('executeRawSelect is not implemented for this dialect');
  }

  /**
   * Build a parameterised SELECT … FROM … JOIN … WHERE … ORDER … SQL string
   * that works with the dialect's placeholder style (? or $n).
   */
  protected buildJoinedSQL(
    tableName: string,
    joins: JoinClause[],
    options: { where?: any; limit?: number; offset?: number; orderBy?: any; columns?: Record<string, boolean> }
  ): { sql: string; values: any[] } {
    const { where, limit, offset, orderBy, columns } = options;

    // SELECT clause
    const selectParts: string[] = [];
    if (columns && Object.keys(columns).length > 0) {
      for (const [k, v] of Object.entries(columns)) {
        if (v) selectParts.push(`"t0"."${k}"`);
      }
    } else {
      selectParts.push('"t0".*');
    }
    for (let i = 0; i < joins.length; i++) {
      const alias = `t${i + 1}`;
      for (const col of joins[i].columns) {
        selectParts.push(`"${alias}"."${col}" AS "j${i}__${col}"`);
      }
    }

    let sqlStr = `SELECT ${selectParts.join(', ')} FROM "${tableName}" "t0"`;

    // JOIN clauses
    for (let i = 0; i < joins.length; i++) {
      const join = joins[i];
      const alias = `t${i + 1}`;
      const joinType = join.type === 'left' ? 'LEFT JOIN' : 'INNER JOIN';
      sqlStr += ` ${joinType} "${join.table}" "${alias}" ON "t0"."${join.on.from}" = "${alias}"."${join.on.to}"`;
    }

    // WHERE clause (main table columns only)
    const values: any[] = [];
    if (where && typeof where === 'object' && Object.getPrototypeOf(where) === Object.prototype) {
      const entries = Object.entries(where);
      if (entries.length > 0) {
        const conditions = entries.map(([k, v]) => {
          values.push(this.normalizeParamValue(v));
          return `"t0"."${k}" = ${this.getParamPlaceholder(values.length)}`;
        });
        sqlStr += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    // ORDER BY
    if (orderBy) {
      if (typeof orderBy === 'string') {
        sqlStr += ` ORDER BY ${orderBy}`;
      } else if (typeof orderBy === 'object' && !Array.isArray(orderBy)) {
        const clauses = Object.entries(orderBy)
          .map(([k, v]) => `"t0"."${k}" ${String(v).toUpperCase()}`);
        sqlStr += ` ORDER BY ${clauses.join(', ')}`;
      }
    }

    if (limit) sqlStr += ` LIMIT ${limit}`;
    if (offset) sqlStr += ` OFFSET ${offset}`;

    return { sql: sqlStr, values };
  }

  /**
   * Post-process raw rows from a joined query.
   * Columns prefixed with "j{n}__" are extracted and either merged flat or
   * nested under join.as (if specified).
   */
  protected processJoinedRows(rows: any[], joins: JoinClause[]): any[] {
    return rows.map(row => {
      const result: any = {};
      const joinData: Record<number, any> = {};
      for (let i = 0; i < joins.length; i++) joinData[i] = {};

      for (const [key, value] of Object.entries(row)) {
        const m = key.match(/^j(\d+)__(.+)$/);
        if (m) {
          joinData[Number(m[1])][m[2]] = value;
        } else {
          result[key] = value;
        }
      }

      for (let i = 0; i < joins.length; i++) {
        if (joins[i].as) {
          result[joins[i].as!] = joinData[i];
        } else {
          Object.assign(result, joinData[i]);
        }
      }

      return result;
    });
  }
}
