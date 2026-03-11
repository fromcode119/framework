/**
 * NamingStrategy - Centralized field name and object normalization
 *
 * Handles conversion between TypeScript camelCase and database snake_case conventions.
 * Used across database dialects and plugin registry for consistent field mapping.
 */

export class NamingStrategy {
  static toSnakeCase(field: string): string {
    return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
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
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }
}