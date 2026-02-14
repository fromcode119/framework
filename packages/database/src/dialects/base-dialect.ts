import { sql, eq, and, desc, asc } from 'drizzle-orm';
import { normalizeParamValue } from '../naming-strategy';

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
}
