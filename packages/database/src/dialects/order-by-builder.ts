import { sql, desc, asc } from 'drizzle-orm';
import { NamingStrategy } from '../naming-strategy';

/**
 * OrderByBuilder - Stateless ORDER BY parsing / clause construction.
 *
 * Shared by every dialect via BaseDialect. Whitelists directions to ASC | DESC
 * and rejects any column that is not a plain identifier, so no caller-supplied
 * string is ever interpolated into SQL as a direction or an unvalidated column.
 */
export class OrderByBuilder {
  /**
   * Whitelist an ORDER BY direction to exactly ASC | DESC.
   * Anything that is not (case-insensitively) "desc" falls back to ASC.
   */
  normalizeOrderDirection(direction: unknown): 'ASC' | 'DESC' {
    return String(direction ?? '').trim().toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  }

  /**
   * Parse a raw ORDER BY string ("createdAt desc, name") into validated
   * { column, direction } pairs. Columns must be plain identifiers
   * (letters, digits, underscore, $); anything else is rejected.
   */
  parseOrderByString(orderBy: string): Array<{ column: string; direction: 'ASC' | 'DESC' }> {
    return String(orderBy)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [column, direction] = part.split(/\s+/);
        return { column: String(column || ''), direction: this.normalizeOrderDirection(direction) };
      })
      .filter((part) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part.column));
  }

  /**
   * Build ORDER BY clause from various formats
   * Supports: string ("created_at desc"), object ({ created_at: 'desc' }), or drizzle expressions
   */
  buildOrderBy(orderBy: any): any {
    if (!orderBy) return null;

    // Array of drizzle expressions - pass through
    if (Array.isArray(orderBy)) {
      return orderBy;
    }

    // String format: "column_name desc" — parsed/validated through the same
    // path as the raw-SQL branch (identifier whitelist + ASC|DESC direction).
    if (typeof orderBy === 'string') {
      const parts = this.parseOrderByString(orderBy);
      if (parts.length === 0) return null;
      return parts.map((part) => {
        const orderFn = part.direction === 'DESC' ? desc : asc;
        return orderFn(sql.identifier(NamingStrategy.toSnakeCase(part.column)));
      });
    }

    // Object format: { column_name: 'desc' }
    if (typeof orderBy === 'object' && Object.getPrototypeOf(orderBy) === Object.prototype) {
      return Object.entries(orderBy).map(([column, direction]) => {
        const orderFn = String(direction).toLowerCase() === 'desc' ? desc : asc;
        return orderFn(sql.identifier(NamingStrategy.toSnakeCase(column)));
      });
    }

    // Drizzle expression - pass through
    return [orderBy];
  }

  /**
   * Build raw SQL ORDER BY clause for string-based queries
   */
  buildRawOrderByClause(orderBy: any): string {
    if (!orderBy) return '';

    if (typeof orderBy === 'string') {
      const parts = this.parseOrderByString(orderBy);
      if (parts.length === 0) return '';
      const clauses = parts
        .map((part) => `"${NamingStrategy.toSnakeCase(part.column)}" ${part.direction}`)
        .join(', ');
      return ` ORDER BY ${clauses}`;
    }

    if (typeof orderBy === 'object' && !Array.isArray(orderBy)) {
      const clauses = Object.entries(orderBy)
        .map(([k, v]) => `"${NamingStrategy.toSnakeCase(k)}" ${this.normalizeOrderDirection(v)}`)
        .join(', ');
      return ` ORDER BY ${clauses}`;
    }

    return '';
  }
}
