
// ── Barrel file (re-exports only) ──────────────────────────────────────────

// Schema tables
export * from '@database/schema';

// Dynamic schema builder
export * from '@database/dynamic-schema';
export type { IDynamicField } from '@database/interfaces/dynamic-field.interface';
export type { IDynamicTableOptions } from '@database/interfaces/dynamic-table-options.interface';

// Core types and interfaces
export type { ISchemaField } from '@database/interfaces/schema-field.interface';
export type { ISchemaCollection } from '@database/interfaces/schema-collection.interface';
export type { IJoinClause } from '@database/interfaces/join-clause.interface';
export type { IDatabaseManager } from '@database/interfaces/database-manager.interface';
export type { IDatabaseDriverCreator } from '@database/interfaces/database-driver-creator.interface';
export type { ITableNameResolver } from '@database/interfaces/table-name-resolver.interface';

// Utilities
export * from '@database/table-resolver';
export { PhysicalTableNameUtils } from '@database/physical-table-name-utils';
export { NamingStrategy } from '@database/naming-strategy';
export { TableArgMethods } from '@database/table-arg-methods';
export { TableResolver } from '@database/table-resolver';
export type { IPhysicalTableReference } from '@database/interfaces/physical-table-reference.interface';
export { BaseMigration } from '@database/base-migration';
export { SchemaKeyField } from '@database/schema-key-field';
export { TenantColumn } from '@database/tenant/tenant-column';
export { SchemaReconcileOutcome } from '@database/schema-reconcile-outcome';
export type { IColumnStats } from '@database/interfaces/column-stats.interface';
export type { IScopedUniqueRules } from '@database/interfaces/scoped-unique-rules.interface';
export type { ITenantBlindUniqueRule } from '@database/interfaces/tenant-blind-unique-rule.interface';
export type { ITenantIsolation } from '@database/interfaces/tenant-isolation.interface';
export type { ITenantPolicySpec } from '@database/interfaces/tenant-policy-spec.interface';
export { TenantConnectionScope } from '@database/tenant/tenant-connection-scope';
// The EXECUTING halves of Postgres tenancy. `TenantIsolationSql` — the statements themselves — is
// deliberately NOT exported: callers get behaviour, never SQL text. These two are here because
// constructing the real implementation against a raw client is what an isolation integration test
// must do; asserting against a copy of the statements would prove only that the copy matches itself.
export { PostgresTenantIsolation } from '@database/dialects/postgres/tenant/tenant-isolation';
export { PostgresTenantSession } from '@database/dialects/postgres/tenant/tenant-session';
export { DatabaseConnectionUrls } from '@database/tenant/database-connection-urls';
export { DatabaseRole } from '@database/roles/database-role';
export { DatabaseRolePlan } from '@database/roles/database-role-plan';
export { DatabaseRoleOutcome } from '@database/roles/database-role-outcome';
export * from '@database/naming-strategy';
export { DatabaseFactory } from '@database/database-factory';
export type { IDatabaseBackupContext } from '@database/dialects/interfaces/database-backup-context.interface';
export type { IDatabaseBackupHandler } from '@database/dialects/interfaces/database-backup-handler.interface';
export type { IDatabaseDialectDefinition } from '@database/dialects/interfaces/database-dialect-definition.interface';
export type { IDatabaseDialectResolver } from '@database/dialects/interfaces/database-dialect-resolver.interface';

// Drizzle ORM re-exports
export { sql, and, or, eq, ne, gt, gte, lt, lte, inArray, notInArray, isNull, isNotNull, exists, notExists, between, notBetween, like, notLike, ilike, notIlike, not, asc, desc, count, avg, sum, min, max, relations, extractTablesRelationalConfig } from 'drizzle-orm';
export * from 'drizzle-orm/pg-core';

// Type aliases for backward compatibility
export type { IDatabaseManager as DatabaseManager } from '@database/interfaces/database-manager.interface';
export { SortDirection } from '@database/enums/sort-direction.enum';
