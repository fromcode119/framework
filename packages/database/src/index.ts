
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
export { PhysicalTableNameUtils } from './physical-table-name-utils';
export type { PhysicalTableReference } from './physical-table-name-utils.interfaces';
export { BaseMigration } from './base-migration';
export * from './naming-strategy';
export { DatabaseFactory } from './database-factory';
export type { DatabaseBackupContext, DatabaseBackupHandler } from './dialects/database-backup.interfaces';
export type { DatabaseDialectDefinition } from './dialects/database-dialect-definition.interfaces';
export type { DatabaseDialectResolver } from './dialects/database-dialect-resolver.interfaces';

// Drizzle ORM re-exports
export { sql, and, or, eq, ne, gt, gte, lt, lte, inArray, notInArray, isNull, isNotNull, exists, notExists, between, notBetween, like, notLike, ilike, notIlike, not, asc, desc, count, avg, sum, min, max, relations, extractTablesRelationalConfig } from 'drizzle-orm';
export * from 'drizzle-orm/pg-core';

// Type aliases for backward compatibility
export type { IDatabaseManager, IDatabaseManager as DatabaseManager, ISchemaCollection, ISchemaField } from './types';
