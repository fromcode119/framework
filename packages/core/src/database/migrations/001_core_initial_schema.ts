import { SystemMigration } from '../../types';

export const InitialFrameworkMigration: SystemMigration = {
  version: 1,
  name: 'Initial core framework schema',
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

    // 3. System Roles Table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "_system_roles" (
        "slug" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "type" TEXT NOT NULL DEFAULT 'custom',
        "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. System Permissions Table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "_system_permissions" (
        "name" TEXT PRIMARY KEY,
        "description" TEXT,
        "plugin_slug" TEXT,
        "group" TEXT,
        "impact" TEXT,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Themes Table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "_system_themes" (
        "slug" TEXT PRIMARY KEY,
        "state" TEXT NOT NULL DEFAULT 'inactive',
        "config" JSONB,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Bridge Tables for Security
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

    // 7. Plugin Settings
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "_system_plugin_settings" (
        "plugin_slug" TEXT PRIMARY KEY REFERENCES "_system_plugins"("slug") ON DELETE CASCADE,
        "settings" JSONB NOT NULL DEFAULT '{}',
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 8. Trusted Publishers
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "_system_trusted_publishers" (
        "publisher_id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT,
        "public_key" TEXT NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 9. System Meta
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "_system_meta" (
        "key" TEXT PRIMARY KEY,
        "value" TEXT NOT NULL,
        "description" TEXT,
        "group" TEXT,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 10. Sessions
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

    // 11. Logs
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

    // 12. Media
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "media_folders" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "parent_id" INTEGER REFERENCES "media_folders"("id") ON DELETE CASCADE,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // 13. System Seeding
    // Roles
    await db.execute(sql`
      INSERT INTO "_system_roles" ("slug", "name", "description", "type", "permissions")
      VALUES 
        ('admin', 'Administrator', 'Full system access', 'system', '["*"]'::jsonb),
        ('editor', 'Editor', 'Content management only', 'custom', '["content:read", "content:write"]'::jsonb),
        ('user', 'User', 'Standard access', 'custom', '[]'::jsonb)
      ON CONFLICT DO NOTHING
    `);

    // Permissions (Full Capabilities)
    await db.execute(sql`
      INSERT INTO "_system_permissions" (name, description, plugin_slug, "group", impact)
      VALUES 
        ('*', 'Global super-user access to all system actions.', 'System', 'General', 'Critical'),
        ('api', 'Core API routing and middleware management.', 'System', 'System', 'High'),
        ('content', 'Dynamic content modeling and retrieval engine.', 'System', 'System', 'Medium'),
        ('i18n', 'Internationalization and localization services.', 'System', 'System', 'Low'),
        ('hooks', 'Events and lifecycle middleware injection.', 'System', 'System', 'High'),
        ('email', 'Transaction and automated email delivery systems.', 'System', 'System', 'Medium'),
        ('storage', 'Cloud and local filesystem storage abstraction.', 'System', 'System', 'Medium'),
        ('security', 'Authentication, encryption and RBAC enforcement.', 'System', 'System', 'Critical'),
        ('monitoring', 'System health, logs and performance telemetry.', 'System', 'System', 'Medium'),
        ('networking', 'External request handling and proxy services.', 'System', 'System', 'High'),
        ('backups', 'Database and asset snapshot management.', 'System', 'System', 'High'),
        ('admin', 'Access to the administrative control panel.', 'System', 'System', 'High'),
        ('frontend', 'Public-facing theme rendering and hydration.', 'System', 'System', 'Medium'),
        ('database:read', 'Low-level database selection and reading.', 'System', 'System', 'Medium'),
        ('database:write', 'Low-level database insertion and modification.', 'System', 'System', 'Critical'),
        ('users:manage', 'Management of system users and their profiles.', 'System', 'System', 'High'),
        ('roles:manage', 'Configuration of RBAC roles and permissions.', 'System', 'System', 'High'),
        ('settings:manage', 'Modification of global platform settings.', 'System', 'System', 'High'),
        ('plugins:manage', 'Installation and lifetime management of plugins.', 'System', 'System', 'Critical'),
        ('media:manage', 'Assets, folders and storage volume management.', 'System', 'System', 'Medium')
      ON CONFLICT DO NOTHING
    `);

    // Initial Security Mapping
    await db.execute(sql`
      INSERT INTO "_system_roles_permissions" (role_slug, permission_name)
      VALUES 
        ('admin', '*'),
        ('editor', 'content')
      ON CONFLICT DO NOTHING
    `);

    // Indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "_system_sessions"("user_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_system_logs_plugin_slug" ON "_system_logs"("plugin_slug")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_media_folder_id" ON "media"("folder_id")`);
  },
  down: async (db, sql) => {
    // Development mode: nuke everything for fresh start
    const tables = [
      'media', 'media_folders', '_system_logs', '_system_sessions', 
      '_system_meta', '_system_trusted_publishers', '_system_plugin_settings',
      '_system_roles_permissions', '_system_users_roles', '_system_themes',
      '_system_permissions', '_system_roles', 'users', '_system_plugins'
    ];
    for (const table of tables) {
      await db.execute(sql`DROP TABLE IF EXISTS "${sql.raw(table)}" CASCADE`);
    }
  }
};
