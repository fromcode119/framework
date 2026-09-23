import { IDatabaseManager, sql } from '@fromcode119/database';

/**
 * MySQL table-creation statements for the initial framework migration.
 *
 * The same tables, in the same order, as the PostgreSQL and SQLite variants beside this file. Three
 * differences are forced by MySQL and none of them is a preference:
 *
 *  - **A key cannot be `TEXT`.** MySQL indexes a variable-length column only with a declared prefix
 *    length, so every column that is a PRIMARY KEY, a UNIQUE, or the target of a FOREIGN KEY is
 *    `VARCHAR(191)` rather than `TEXT`. 191 rather than 255 because the framework's tables are
 *    `utf8mb4`, where an index entry is 4 bytes per character and the old InnoDB limit is 767 bytes
 *    — 191 is the largest width that still fits a deployment running without `innodb_large_prefix`.
 *  - **`AUTOINCREMENT` is `AUTO_INCREMENT`,** and it belongs to an `INT`, not to the primary key
 *    declaration.
 *  - **Identifiers are double-quoted here** and MySQL only accepts that in `ANSI_QUOTES` mode, which
 *    `MysqlDatabaseManager` sets on every pooled connection. Writing backticks instead would make
 *    this file the only one in the tree that cannot be read beside its two siblings.
 *
 * Everything else — column names, order, defaults, cascade behaviour — matches the other two
 * dialects exactly, so a row exported from one deployment imports into another.
 */
export class InitialFrameworkMysqlTables {
  /** The width every indexed string column uses. See the class docblock for why it is 191. */
  private static readonly KEY = 'VARCHAR(191)';

  static async create(db: IDatabaseManager): Promise<void> {
    const { KEY } = InitialFrameworkMysqlTables;

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_plugins" (
            "slug" ${KEY} PRIMARY KEY,
            "state" VARCHAR(64) NOT NULL DEFAULT 'inactive',
            "version" VARCHAR(64),
            "latest_version" VARCHAR(64),
            "has_update" BOOLEAN DEFAULT FALSE,
            "backup_path" TEXT,
            "signature_verified" BOOLEAN DEFAULT FALSE,
            "health_status" VARCHAR(64) DEFAULT 'healthy',
            "capabilities" TEXT,
            "sandbox_config" JSON,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "held_reason" TEXT
          )
        `));

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "users" (
            "id" INT AUTO_INCREMENT PRIMARY KEY,
            "email" ${KEY} NOT NULL UNIQUE,
            "username" ${KEY} UNIQUE,
            "password" TEXT NOT NULL,
            "roles" JSON,
            "permissions" JSON,
            "first_name" TEXT,
            "last_name" TEXT,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `));

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_roles" (
            "slug" ${KEY} PRIMARY KEY,
            "name" VARCHAR(255) NOT NULL,
            "description" TEXT,
            "type" VARCHAR(64) NOT NULL DEFAULT 'custom',
            "permissions" JSON,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `));

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_permissions" (
            "name" ${KEY} PRIMARY KEY,
            "description" TEXT,
            "plugin_slug" VARCHAR(191),
            "group" VARCHAR(191),
            "impact" VARCHAR(64),
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `));

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_themes" (
            "slug" ${KEY} PRIMARY KEY,
            "state" VARCHAR(64) NOT NULL DEFAULT 'inactive',
            "config" JSON,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "name" TEXT,
            "version" TEXT,
            "created_at" DATETIME
          )
        `));

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_users_roles" (
            "user_id" INT NOT NULL,
            "role_slug" ${KEY} NOT NULL,
            PRIMARY KEY ("user_id", "role_slug"),
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
            FOREIGN KEY ("role_slug") REFERENCES "_system_roles"("slug") ON DELETE CASCADE
          )
        `));

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_roles_permissions" (
            "role_slug" ${KEY} NOT NULL,
            "permission_name" ${KEY} NOT NULL,
            PRIMARY KEY ("role_slug", "permission_name"),
            FOREIGN KEY ("role_slug") REFERENCES "_system_roles"("slug") ON DELETE CASCADE,
            FOREIGN KEY ("permission_name") REFERENCES "_system_permissions"("name") ON DELETE CASCADE
          )
        `));

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_plugin_settings" (
            "plugin_slug" ${KEY} PRIMARY KEY,
            "settings" JSON,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("plugin_slug") REFERENCES "_system_plugins"("slug") ON DELETE CASCADE
          )
        `));

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_trusted_publishers" (
            "publisher_id" ${KEY} PRIMARY KEY,
            "name" VARCHAR(255) NOT NULL,
            "email" VARCHAR(255),
            "public_key" TEXT NOT NULL,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `));

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_meta" (
            "key" ${KEY} PRIMARY KEY,
            "value" TEXT NOT NULL,
            "description" TEXT,
            "group" VARCHAR(191),
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `));

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_sessions" (
            "id" ${KEY} PRIMARY KEY,
            "user_id" INT NOT NULL,
            "token_id" ${KEY} UNIQUE NOT NULL,
            "user_agent" TEXT,
            "ip_address" VARCHAR(64),
            "is_revoked" BOOLEAN NOT NULL DEFAULT FALSE,
            "expires_at" TIMESTAMP NOT NULL,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
          )
        `));

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_logs" (
            "id" INT AUTO_INCREMENT PRIMARY KEY,
            "plugin_slug" VARCHAR(191),
            "level" VARCHAR(32) NOT NULL,
            "message" TEXT NOT NULL,
            "context" TEXT,
            "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `));

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "media_folders" (
            "id" INT AUTO_INCREMENT PRIMARY KEY,
            "name" VARCHAR(255) NOT NULL,
            "parent_id" INT,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("parent_id") REFERENCES "media_folders"("id") ON DELETE CASCADE
          )
        `));

    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "media" (
            "id" INT AUTO_INCREMENT PRIMARY KEY,
            "filename" VARCHAR(255) NOT NULL,
            "original_name" VARCHAR(255) NOT NULL,
            "mime_type" VARCHAR(191) NOT NULL,
            "file_size" INT NOT NULL,
            "width" INT,
            "height" INT,
            "alt" TEXT,
            "path" TEXT NOT NULL,
            "folder_id" INT,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "caption" TEXT,
            "optimized_path" TEXT,
            "optimized_size" INT,
            "optimized_width" INT,
            "optimized_height" INT,
            FOREIGN KEY ("folder_id") REFERENCES "media_folders"("id") ON DELETE SET NULL
          )
        `));

    // `plugin_slug` and `status` are indexed, and MySQL cannot index an unbounded column.
    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_audit_logs" (
            "id" INT AUTO_INCREMENT PRIMARY KEY,
            "plugin_slug" VARCHAR(191) NOT NULL,
            "action" VARCHAR(191) NOT NULL,
            "resource" TEXT,
            "status" VARCHAR(64) NOT NULL,
            "metadata" JSON,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `));

    // `name` is UNIQUE and `plugin_slug` references _system_plugins, so neither can be TEXT here.
    await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_scheduler_tasks" (
            "id" INT AUTO_INCREMENT PRIMARY KEY,
            "name" VARCHAR(191) NOT NULL UNIQUE,
            "plugin_slug" VARCHAR(191),
            "schedule" VARCHAR(255) NOT NULL,
            "type" VARCHAR(32) NOT NULL DEFAULT 'cron',
            "last_run" TIMESTAMP NULL,
            "next_run" TIMESTAMP NULL,
            "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("plugin_slug") REFERENCES "_system_plugins"("slug") ON DELETE CASCADE
          )
        `));
  }
}
