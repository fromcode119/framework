import { SqlColumns } from '@database/sql/sql-columns';
import { SqlTable } from '@database/sql/sql-table';

/**
 * The framework's system tables. Queries take the table objects as values; they live as static
 * members of this class so the codebase exposes only classes (no bare `export const`).
 */
export class Schema {
  static readonly users = SqlTable.define('users', {
  // The flag that decides platform access. Load-bearing for authorization and read all over the
  // framework, so it belongs in the schema rather than only in raw SQL.
  isPlatformAdmin: SqlColumns.boolean('is_platform_admin').notNull().default(false),
  id: SqlColumns.serial('id').primaryKey(),
  email: SqlColumns.text('email').notNull().unique(),
  username: SqlColumns.text('username').unique(),
  password: SqlColumns.text('password').notNull(),
  roles: SqlColumns.jsonb('roles').default([]),
  permissions: SqlColumns.jsonb('permissions').default([]),
  firstName: SqlColumns.text('first_name'),
  lastName: SqlColumns.text('last_name'),
  createdAt: SqlColumns.timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: SqlColumns.timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
  static readonly systemRecordVersions = SqlTable.define('_system_record_versions', {
  updatedAt: SqlColumns.timestamp('updated_at', { withTimezone: true }).defaultNow(),
  // Set by the database from `app.tenant_id` on insert; row-level security filters on it. Declared so
  // a reader can SEE the column — an undeclared column is silently absent from every `db.find`, which
  // is how a filter on one matches nothing and looks like it is working.
  tenantId: SqlColumns.text('tenant_id'),
  id: SqlColumns.serial('id').primaryKey(),
  refId: SqlColumns.text('ref_id').notNull(),
  refCollection: SqlColumns.text('ref_collection').notNull(),
  version: SqlColumns.integer('version').notNull().default(1),
  versionData: SqlColumns.jsonb('version_data').notNull(),
  updatedBy: SqlColumns.integer('updated_by').references(() => Schema.users.id, { onDelete: 'set null' }),
  changeSummary: SqlColumns.text('change_summary'),
  createdAt: SqlColumns.timestamp('created_at', { withTimezone: true }).defaultNow(),
});
  static readonly systemRoles = SqlTable.define('_system_roles', {
  slug: SqlColumns.text('slug').primaryKey(),
  name: SqlColumns.text('name').notNull(),
  description: SqlColumns.text('description'),
  type: SqlColumns.text('type').notNull().default('custom'), // 'system' or 'custom'
  permissions: SqlColumns.jsonb('permissions').notNull().default([]), // List of capability names
  // Which plugin declared this role, or NULL for the framework's own (migration 046). A site is shown
  // its own plugins' roles and the unattributed ones, never another product's.
  pluginSlug: SqlColumns.text('plugin_slug'),
  createdAt: SqlColumns.timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: SqlColumns.timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

  static readonly systemPermissions = SqlTable.define('_system_permissions', {
  name: SqlColumns.text('name').primaryKey(),
  description: SqlColumns.text('description'),
  pluginSlug: SqlColumns.text('plugin_slug'),
  group: SqlColumns.text('group'),
  impact: SqlColumns.text('impact'), // low, medium, high, critical
  createdAt: SqlColumns.timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: SqlColumns.timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

  static readonly systemUsersToRoles = SqlTable.define('_system_users_roles', {
  userId: SqlColumns.integer('user_id').notNull().references(() => Schema.users.id, { onDelete: 'cascade' }),
  roleSlug: SqlColumns.text('role_slug').notNull().references(() => Schema.systemRoles.slug, { onDelete: 'cascade' }),
}, (t) => ({
  pk: [t.userId, t.roleSlug],
}));

  static readonly systemRolesToPermissions = SqlTable.define('_system_roles_permissions', {
  roleSlug: SqlColumns.text('role_slug').notNull().references(() => Schema.systemRoles.slug, { onDelete: 'cascade' }),
  permissionName: SqlColumns.text('permission_name').notNull().references(() => Schema.systemPermissions.name, { onDelete: 'cascade' }),
}, (t) => ({
  pk: [t.roleSlug, t.permissionName],
}));

  static readonly systemPlugins = SqlTable.define('_system_plugins', {
  heldReason: SqlColumns.text('held_reason'),
  // Which SITE uploaded this plugin; NULL is the platform's own (migration 045).
  ownerTenantId: SqlColumns.text('owner_tenant_id'),
  slug: SqlColumns.text('slug').primaryKey(),
  version: SqlColumns.text('version'),
  state: SqlColumns.text('state').notNull().default('inactive'),
  capabilities: SqlColumns.text('capabilities'), // JSON string of approved capabilities
  latestVersion: SqlColumns.text('latest_version'),
  hasUpdate: SqlColumns.boolean('has_update').default(false),
  backupPath: SqlColumns.text('backup_path'),
  signatureVerified: SqlColumns.boolean('signature_verified').default(false),
  healthStatus: SqlColumns.text('health_status').default('healthy'), // healthy, error, warning
  sandboxConfig: SqlColumns.jsonb('sandbox_config'),
  /** T5c: the OS user this plugin's isolated process runs as (PLUGIN_UID_BASE + n), fixed on first isolated start. */
  isolationUid: SqlColumns.integer('isolation_uid'),
  updatedAt: SqlColumns.timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

  static readonly trustedPublishers = SqlTable.define('_system_trusted_publishers', {
  publisherId: SqlColumns.text('publisher_id').primaryKey(),
  name: SqlColumns.text('name').notNull(),
  email: SqlColumns.text('email'),
  publicKey: SqlColumns.text('public_key').notNull(),
  isActive: SqlColumns.boolean('is_active').notNull().default(true),
  createdAt: SqlColumns.timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: SqlColumns.timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

  static readonly systemPluginSettings = SqlTable.define('_system_plugin_settings', {
  // Set by the database from `app.tenant_id` on insert; row-level security filters on it. Declared so
  // a reader can SEE the column — an undeclared column is silently absent from every `db.find`, which
  // is how a filter on one matches nothing and looks like it is working.
  tenantId: SqlColumns.text('tenant_id'),
  pluginSlug: SqlColumns.text('plugin_slug').primaryKey().references(() => Schema.systemPlugins.slug, { onDelete: 'cascade' }),
  settings: SqlColumns.jsonb('settings').notNull().default({}),
  updatedAt: SqlColumns.timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

  static readonly systemSessions = SqlTable.define('_system_sessions', {
  // Set by the database from `app.tenant_id` on insert; row-level security filters on it. Declared so
  // a reader can SEE the column — an undeclared column is silently absent from every `db.find`, which
  // is how a filter on one matches nothing and looks like it is working.
  tenantId: SqlColumns.text('tenant_id'),
  id: SqlColumns.uuid('id').primaryKey().defaultRandom(),
  userId: SqlColumns.integer('user_id').notNull().references(() => Schema.users.id, { onDelete: 'cascade' }),
  tokenId: SqlColumns.text('token_id').notNull().unique(),
  userAgent: SqlColumns.text('user_agent'),
  ipAddress: SqlColumns.text('ip_address'),
  isRevoked: SqlColumns.boolean('is_revoked').notNull().default(false),
  expiresAt: SqlColumns.timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: SqlColumns.timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: SqlColumns.timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

  static readonly systemMeta = SqlTable.define('_system_meta', {
  // Set by the database from `app.tenant_id` on insert; row-level security filters on it. Declared so
  // a reader can SEE the column — an undeclared column is silently absent from every `db.find`, which
  // is how a filter on one matches nothing and looks like it is working.
  tenantId: SqlColumns.text('tenant_id'),
  key: SqlColumns.text('key').primaryKey(),
  value: SqlColumns.text('value').notNull(),
  description: SqlColumns.text('description'),
  group: SqlColumns.text('group'),
  updatedAt: SqlColumns.timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

  static readonly systemLogs = SqlTable.define('_system_logs', {
  // Set by the database from `app.tenant_id` on insert; row-level security filters on it. Declared so
  // a reader can SEE the column — an undeclared column is silently absent from every `db.find`, which
  // is how a filter on one matches nothing and looks like it is working.
  tenantId: SqlColumns.text('tenant_id'),
  id: SqlColumns.serial('id').primaryKey(),
  pluginSlug: SqlColumns.text('plugin_slug'),
  level: SqlColumns.text('level').notNull(),
  message: SqlColumns.text('message').notNull(),
  context: SqlColumns.jsonb('context'),
  timestamp: SqlColumns.timestamp('timestamp', { withTimezone: true }).defaultNow(),
});

  static readonly systemAuditLogs = SqlTable.define('_system_audit_logs', {
  // Set by the database from `app.tenant_id` on insert; row-level security filters on it. Declared so
  // a reader can SEE the column — an undeclared column is silently absent from every `db.find`, which
  // is how a filter on one matches nothing and looks like it is working.
  tenantId: SqlColumns.text('tenant_id'),
  id: SqlColumns.serial('id').primaryKey(),
  pluginSlug: SqlColumns.text('plugin_slug'),
  action: SqlColumns.text('action').notNull(),
  resource: SqlColumns.text('resource').notNull(),
  status: SqlColumns.text('status').notNull(), // allowed, denied, violation
  metadata: SqlColumns.jsonb('metadata'),
  createdAt: SqlColumns.timestamp('created_at', { withTimezone: true }).defaultNow(),
});

  static readonly systemThemes = SqlTable.define('_system_themes', {
  name: SqlColumns.text('name'),
  version: SqlColumns.text('version'),
  // Which SITE uploaded this theme; NULL is the platform's own (migration 045).
  ownerTenantId: SqlColumns.text('owner_tenant_id'),
  createdAt: SqlColumns.timestamp('created_at', { withTimezone: true }),
  slug: SqlColumns.text('slug').primaryKey(),
  state: SqlColumns.text('state').notNull().default('inactive'),
  config: SqlColumns.jsonb('config'),
  updatedAt: SqlColumns.timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

  static readonly mediaFolders = SqlTable.define('media_folders', {
  // Set by the database from `app.tenant_id` on insert; row-level security filters on it. Declared so
  // a reader can SEE the column — an undeclared column is silently absent from every `db.find`, which
  // is how a filter on one matches nothing and looks like it is working.
  tenantId: SqlColumns.text('tenant_id').notNull(),
  id: SqlColumns.serial('id').primaryKey(),
  name: SqlColumns.text('name').notNull(),
  parentId: SqlColumns.integer('parent_id'),
  createdAt: SqlColumns.timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: SqlColumns.timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

  static readonly media = SqlTable.define('media', {
  // Set by the database from `app.tenant_id` on insert; row-level security filters on it. Declared so
  // a reader can SEE the column — an undeclared column is silently absent from every `db.find`, which
  // is how a filter on one matches nothing and looks like it is working.
  tenantId: SqlColumns.text('tenant_id').notNull(),
  integration: SqlColumns.text('integration').notNull().default('storage'),
  provider: SqlColumns.text('provider').notNull().default('local'),
  shared: SqlColumns.boolean('shared').notNull().default(false),
  id: SqlColumns.serial('id').primaryKey(),
  filename: SqlColumns.text('filename').notNull(),
  originalName: SqlColumns.text('original_name').notNull(),
  mimeType: SqlColumns.text('mime_type').notNull(),
  fileSize: SqlColumns.integer('file_size').notNull(),
  width: SqlColumns.integer('width'),
  height: SqlColumns.integer('height'),
  alt: SqlColumns.text('alt'),
  caption: SqlColumns.text('caption'),
  path: SqlColumns.text('path').notNull(),
  folderId: SqlColumns.integer('folder_id').references(() => Schema.mediaFolders.id, { onDelete: 'set null' }),
  // Nullable on purpose: the column is added to existing installs by schema sync, so rows written
  // before it existed hold NULL. `MediaVisibility.resolve` reads NULL as public, which is what those
  // rows factually are — their bytes are already under a static mount.
  visibility: SqlColumns.text('visibility').default('public'),
  optimizedPath: SqlColumns.text('optimized_path'),
  optimizedSize: SqlColumns.integer('optimized_size'),
  optimizedWidth: SqlColumns.integer('optimized_width'),
  optimizedHeight: SqlColumns.integer('optimized_height'),
  createdAt: SqlColumns.timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: SqlColumns.timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

}
