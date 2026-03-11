
// ── Barrel file (re-exports only) ──────────────────────────────────────────

// Schema tables
export * from './schema';

// Dynamic schema builder
export * from './dynamic-schema';
export type { DynamicField, DynamicTableOptions } from './dynamic-schema.interfaces';

// Core types and interfaces
export * from './types';

// Utilities
export * from './table-resolver';
export * from './naming-strategy';
export { DatabaseFactory } from './database-factory';

// Drizzle ORM re-exports
export { sql, and, or, eq, ne, gt, gte, lt, lte, inArray, notInArray, isNull, isNotNull, exists, notExists, between, notBetween, like, notLike, ilike, notIlike, not, asc, desc, count, avg, sum, min, max, relations, extractTablesRelationalConfig } from 'drizzle-orm';
export * from 'drizzle-orm/pg-core';

// Type aliases for backward compatibility
export type { IDatabaseManager, IDatabaseManager as DatabaseManager, ISchemaCollection, ISchemaField } from './types';