import { IDatabaseManager, sql } from '@fromcode119/database';

/**
 * SQLite table-creation statements for the initial framework migration. Each `db.execute`
 * call is the SAME, in the SAME ORDER, as the inline statements it replaced; the emitted SQL is
 * byte-for-byte identical.
 */
export class InitialFrameworkSqliteTables {
  static async create(db: IDatabaseManager): Promise<void> {
    // SQLite equivalents
    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_plugins" (
            "slug" TEXT PRIMARY KEY,
            "state" TEXT NOT NULL DEFAULT 'inactive',
            "version" TEXT,
            "latest_version" TEXT,
            "has_update" INTEGER DEFAULT 0,
            "backup_path" TEXT,
            "signature_verified" INTEGER DEFAULT 0,
            "health_status" TEXT DEFAULT 'healthy',
            "capabilities" TEXT,
            "sandbox_config" TEXT DEFAULT '{}',
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "users" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "email" TEXT NOT NULL UNIQUE,
            "username" TEXT UNIQUE,
            "password" TEXT NOT NULL,
            "roles" TEXT DEFAULT '[]',
            "permissions" TEXT DEFAULT '[]',
            "first_name" TEXT,
            "last_name" TEXT,
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_roles" (
            "slug" TEXT PRIMARY KEY,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "type" TEXT NOT NULL DEFAULT 'custom',
            "permissions" TEXT NOT NULL DEFAULT '[]',
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_permissions" (
            "name" TEXT PRIMARY KEY,
            "description" TEXT,
            "plugin_slug" TEXT,
            "group" TEXT,
            "impact" TEXT,
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_themes" (
            "slug" TEXT PRIMARY KEY,
            "state" TEXT NOT NULL DEFAULT 'inactive',
            "config" TEXT,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_users_roles" (
            "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "role_slug" TEXT NOT NULL REFERENCES "_system_roles"("slug") ON DELETE CASCADE,
            PRIMARY KEY ("user_id", "role_slug")
          )
        `);

    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_roles_permissions" (
            "role_slug" TEXT NOT NULL REFERENCES "_system_roles"("slug") ON DELETE CASCADE,
            "permission_name" TEXT NOT NULL REFERENCES "_system_permissions"("name") ON DELETE CASCADE,
            PRIMARY KEY ("role_slug", "permission_name")
          )
        `);

    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_plugin_settings" (
            "plugin_slug" TEXT PRIMARY KEY REFERENCES "_system_plugins"("slug") ON DELETE CASCADE,
            "settings" TEXT NOT NULL DEFAULT '{}',
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_trusted_publishers" (
            "publisher_id" TEXT PRIMARY KEY,
            "name" TEXT NOT NULL,
            "email" TEXT,
            "public_key" TEXT NOT NULL,
            "is_active" INTEGER NOT NULL DEFAULT 1,
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_meta" (
            "key" TEXT PRIMARY KEY,
            "value" TEXT NOT NULL,
            "description" TEXT,
            "group" TEXT,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_sessions" (
            "id" TEXT PRIMARY KEY,
            "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "token_id" TEXT UNIQUE NOT NULL,
            "user_agent" TEXT,
            "ip_address" TEXT,
            "is_revoked" INTEGER NOT NULL DEFAULT 0,
            "expires_at" DATETIME NOT NULL,
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_logs" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "plugin_slug" TEXT,
            "level" TEXT NOT NULL,
            "message" TEXT NOT NULL,
            "context" TEXT,
            "timestamp" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "media_folders" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "name" TEXT NOT NULL,
            "parent_id" INTEGER REFERENCES "media_folders"("id") ON DELETE CASCADE,
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

    await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "media" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "filename" TEXT NOT NULL,
            "original_name" TEXT NOT NULL,
            "mime_type" TEXT NOT NULL,
            "file_size" INTEGER NOT NULL,
            "width" INTEGER,
            "height" INTEGER,
            "alt" TEXT,
            "path" TEXT NOT NULL,
            "folder_id" INTEGER REFERENCES "media_folders"("id") ON DELETE SET NULL,
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
  }
}
