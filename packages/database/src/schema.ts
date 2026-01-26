import { pgTable, text, timestamp, pgSchema, serial, boolean, integer, jsonb, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').unique(),
  password: text('password').notNull(),
  roles: jsonb('roles').default([]),
  permissions: jsonb('permissions').default([]),
  firstName: text('first_name'),
  lastName: text('last_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const systemPlugins = pgTable('_system_plugins', {
  slug: text('slug').primaryKey(),
  version: text('version'),
  state: text('state').notNull().default('inactive'),
  capabilities: text('capabilities'), // JSON string of approved capabilities
  latestVersion: text('latest_version'),
  hasUpdate: boolean('has_update').default(false),
  backupPath: text('backup_path'),
  signatureVerified: boolean('signature_verified').default(false),
  healthStatus: text('health_status').default('healthy'), // healthy, error, warning
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const trustedPublishers = pgTable('_system_trusted_publishers', {
  publisherId: text('publisher_id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  publicKey: text('public_key').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const systemPluginSettings = pgTable('_system_plugin_settings', {
  pluginSlug: text('plugin_slug').primaryKey().references(() => systemPlugins.slug, { onDelete: 'cascade' }),
  settings: jsonb('settings').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const systemSessions = pgTable('_system_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenId: text('token_id').notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  isRevoked: boolean('is_revoked').notNull().default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const systemMeta = pgTable('_system_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const systemLogs = pgTable('_system_logs', {
  id: serial('id').primaryKey(),
  pluginSlug: text('plugin_slug'),
  level: text('level').notNull(),
  message: text('message').notNull(),
  context: jsonb('context'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
});

export const mediaFolders = pgTable('media_folders', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  parentId: integer('parent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const media = pgTable('media', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  width: integer('width'),
  height: integer('height'),
  alt: text('alt'),
  path: text('path').notNull(),
  folderId: integer('folder_id').references(() => mediaFolders.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Introspection Schema for info-schema queries
export const infoSchema = pgSchema('information_schema');
export const infoTables = infoSchema.table('tables', {
  tableName: text('table_name'),
  tableSchema: text('table_schema'),
});
export const infoColumns = infoSchema.table('columns', {
  tableName: text('table_name'),
  columnName: text('column_name'),
  tableSchema: text('table_schema'),
});
