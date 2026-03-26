export { DatabaseFactory, sql } from '@fromcode119/database';
// Table name resolution — converts semantic refs like @plugin/table to physical table names.
// Use in migrations where raw SQL requires the physical table name.
export { TableResolver } from '@fromcode119/database';
// Base class for plugin database migrations.
export { BaseMigration } from '@fromcode119/database';
// Database manager interface and schema field/collection types for migrations.
export type { IDatabaseManager, ISchemaField, ISchemaCollection } from '@fromcode119/database';
