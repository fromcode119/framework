import { SystemMigration } from '../../types';

export const InitialSchemaMigration: SystemMigration = {
  version: 1,
  name: 'Initial framework schema',
  up: async (db, sql) => {
    // 1. Plugins Table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "_system_plugins" (
        "slug" TEXT PRIMARY KEY,
        "state" TEXT NOT NULL DEFAULT 'inactive',
        "version" TEXT,
        "latest_version" TEXT,
        "has_update" BOOLEAN DEFAULT FALSE,
        "backup_path" TEXT,
        "signature_verified" BOOLEAN DEFAULT FALSE,
        "health_status" TEXT DEFAULT 'healthy',
        "capabilities" TEXT,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Users Table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "username" TEXT UNIQUE,
        "password" TEXT NOT NULL,
        "roles" JSONB DEFAULT '[]'::jsonb,
        "permissions" JSONB DEFAULT '[]'::jsonb,
        "first_name" TEXT,
        "last_name" TEXT,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Plugin Settings
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "_system_plugin_settings" (
        "plugin_slug" TEXT PRIMARY KEY REFERENCES "_system_plugins"("slug") ON DELETE CASCADE,
        "settings" JSONB NOT NULL DEFAULT '{}',
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Sessions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "_system_sessions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_id" TEXT UNIQUE NOT NULL,
        "user_agent" TEXT,
        "ip_address" TEXT,
        "is_revoked" BOOLEAN NOT NULL DEFAULT FALSE,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "_system_sessions"("user_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_sessions_token_id" ON "_system_sessions"("token_id")`);

    // 5. Logs
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "_system_logs" (
        "id" SERIAL PRIMARY KEY,
        "plugin_slug" TEXT,
        "level" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "context" JSONB,
        "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_system_logs_plugin_slug" ON "_system_logs"("plugin_slug")`);

    // 6. Media Folders
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "media_folders" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "parent_id" INTEGER REFERENCES "media_folders"("id") ON DELETE CASCADE,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 7. Media
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "media" (
        "id" SERIAL PRIMARY KEY,
        "filename" TEXT NOT NULL,
        "original_name" TEXT NOT NULL,
        "mime_type" TEXT NOT NULL,
        "file_size" INTEGER NOT NULL,
        "width" INTEGER,
        "height" INTEGER,
        "alt" TEXT,
        "path" TEXT NOT NULL,
        "folder_id" INTEGER REFERENCES "media_folders"("id") ON DELETE SET NULL,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_media_folder_id" ON "media"("folder_id")`);
  },
  down: async (db, sql) => {
    await db.execute(sql`DROP TABLE IF EXISTS "media"`);
    await db.execute(sql`DROP TABLE IF EXISTS "media_folders"`);
    await db.execute(sql`DROP TABLE IF EXISTS "_system_logs"`);
    await db.execute(sql`DROP TABLE IF EXISTS "_system_sessions"`);
    await db.execute(sql`DROP TABLE IF EXISTS "_system_plugin_settings"`);
    await db.execute(sql`DROP TABLE IF EXISTS "users"`);
    await db.execute(sql`DROP TABLE IF EXISTS "_system_plugins"`);
  }
};
