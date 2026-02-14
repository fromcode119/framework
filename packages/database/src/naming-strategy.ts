/**
 * NamingStrategy - Centralized field name and object normalization
 * 
 * Handles conversion between TypeScript camelCase and database snake_case conventions.
 * Used across database dialects and plugin registry for consistent field mapping.
 */

/**
 * Convert camelCase to snake_case
 * Example: createdAt -> created_at
 */
export function toSnakeCase(field: string): string {
  return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 * Example: created_at -> createdAt
 */
export function toCamelCase(field: string): string {
  return field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Check if value is a plain object (not an array, Date, etc.)
 */
export function isPlainObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Normalize a WHERE clause object from camelCase to snake_case
 */
export function normalizeWhereClause(input: any): any {
  if (!isPlainObject(input)) return input;
  
  const output: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    output[toSnakeCase(key)] = value;
  }
  return output;
}

/**
 * Normalize a data object (for insert/update) from camelCase to snake_case
 */
export function normalizeRecord(input: any): any {
  if (!isPlainObject(input)) return input;
  
  const output: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    output[toSnakeCase(key)] = value;
  }
  return output;
}

/**
 * Denormalize a database record from snake_case to camelCase
 */
export function denormalizeRecord(input: any): any {
  if (!isPlainObject(input)) return input;
  
  const output: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    output[toCamelCase(key)] = value;
  }
  return output;
}

/**
 * Normalize find options (where, orderBy, columns)
 */
export function normalizeFindOptions(options: any): any {
  if (!options || typeof options !== 'object') return options;
  
  const normalized = { ...options };
  
  if (normalized.where) {
    normalized.where = normalizeWhereClause(normalized.where);
  }
  
  if (isPlainObject(normalized.columns)) {
    const mapped: Record<string, any> = {};
    for (const [key, value] of Object.entries(normalized.columns)) {
      mapped[toSnakeCase(key)] = value;
    }
    normalized.columns = mapped;
  }
  
  if (isPlainObject(normalized.orderBy)) {
    const mapped: Record<string, any> = {};
    for (const [key, value] of Object.entries(normalized.orderBy)) {
      mapped[toSnakeCase(key)] = value;
    }
    normalized.orderBy = mapped;
  }
  
  return normalized;
}

/**
 * Normalize parameter values for database queries
 * Handles undefined, null, Date, Buffer, and objects (JSON stringify)
 */
export function normalizeParamValue(value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

export class NamingStrategy {
  static toSnakeCase = toSnakeCase;
  static toCamelCase = toCamelCase;
  static isPlainObject = isPlainObject;
  static normalizeWhereClause = normalizeWhereClause;
  static normalizeRecord = normalizeRecord;
  static denormalizeRecord = denormalizeRecord;
  static normalizeFindOptions = normalizeFindOptions;
  static normalizeParamValue = normalizeParamValue;
}
