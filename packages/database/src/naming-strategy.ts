/**
 * NamingStrategy - Centralized field name and object normalization
 *
 * Handles conversion between TypeScript camelCase and database snake_case conventions.
 * Used across database dialects and plugin registry for consistent field mapping.
 */

export class NamingStrategy {
  /** A column name safe to interpolate into SQL: letters, digits, underscore; never leading-digit. */
  private static readonly SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

  static toSnakeCase(field: string): string {
    return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Snake-case a canonical field name for use as a SQL identifier, rejecting anything that is not a
   * plain identifier.
   *
   * Column names are the one caller-supplied value that reaches SQL as CODE rather than as a bound
   * parameter, and neither plain double-quoting nor drizzle's `sql.identifier` escapes an embedded
   * double quote — such a name would close the quoted identifier and inject. Canonical schema field
   * names are always plain identifiers, so anything else is rejected rather than escaped.
   */
  static toSafeColumnIdentifier(field: string): string {
    const identifier = NamingStrategy.toSnakeCase(String(field ?? ''));
    if (!NamingStrategy.SAFE_IDENTIFIER.test(identifier)) {
      throw new Error(`Invalid column identifier: ${JSON.stringify(String(field ?? ''))}`);
    }
    return identifier;
  }

  static toSnakeIdentifier(value: string): string {
    return String(value || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')
      .toLowerCase();
  }

  static toCamelCase(field: string): string {
    return field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  static isPlainObject(value: unknown): value is Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.prototype.toString.call(value) === '[object Object]';
  }

  static normalizeWhereClause(input: any): any {
    if (!NamingStrategy.isPlainObject(input)) return input;
    const output: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      output[NamingStrategy.toSnakeCase(key)] = value;
    }
    return output;
  }

  static normalizeRecord(input: any): any {
    if (!NamingStrategy.isPlainObject(input)) return input;
    const output: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      output[NamingStrategy.toSnakeCase(key)] = value;
    }
    return output;
  }

  static denormalizeRecord(input: any): any {
    if (!NamingStrategy.isPlainObject(input)) return input;
    const output: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      output[NamingStrategy.toCamelCase(key)] = value;
    }
    return output;
  }

  static normalizeFindOptions(options: any): any {
    if (!options || typeof options !== 'object') return options;
    const normalized = { ...options };
    if (normalized.where) normalized.where = NamingStrategy.normalizeWhereClause(normalized.where);
    if (NamingStrategy.isPlainObject(normalized.columns)) {
      const mapped: Record<string, any> = {};
      for (const [key, value] of Object.entries(normalized.columns)) mapped[NamingStrategy.toSnakeCase(key)] = value;
      normalized.columns = mapped;
    }
    if (NamingStrategy.isPlainObject(normalized.orderBy)) {
      const mapped: Record<string, any> = {};
      for (const [key, value] of Object.entries(normalized.orderBy)) mapped[NamingStrategy.toSnakeCase(key)] = value;
      normalized.orderBy = mapped;
    }
    return normalized;
  }

  static normalizeParamValue(value: any): any {
    if (value === undefined) return null;
    if (value === null) return null;
    if (value instanceof Date) return value;
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'object') {
      // An object whose `toJSON()` yields a PRIMITIVE stands for that primitive, so store it directly.
      // `JSON.stringify` would wrap it in quotes: a reactor `Enum` returns its value from `toJSON()`,
      // so `ScheduleType.INTERVAL` reached the column as the literal `"interval"` rather than
      // `interval`. Reading it back matched no member, and `ScheduleType.resolve` fell through to its
      // CRON default — which is how a `2m` INTERVAL task came to be validated as a cron expression.
      // Fixing it here rather than at each call site: every enum written to any column had the same
      // fault, and a per-caller `.value` is one someone must remember every time.
      const asJson = (value as { toJSON?: () => unknown }).toJSON?.();
      if (asJson !== undefined && asJson !== null && typeof asJson !== 'object') return asJson;
      return JSON.stringify(value);
    }
    return value;
  }
}