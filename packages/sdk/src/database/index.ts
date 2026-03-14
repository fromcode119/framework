export { DatabaseFactory, sql } from '@fromcode119/database';
// Table name resolution — converts @plugin/table → fcp_plugin_table.
// Use in migrations where raw SQL requires the physical table name.
// Import via: import { TableResolver } from '@fromcode119/sdk/table';
export { TableResolver } from '@fromcode119/database';