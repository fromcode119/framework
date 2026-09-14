import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

export class PeopleIdentityMigration extends BaseMigration {
  readonly version = 9;
  readonly name = 'People identity schema';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "people" (
            "id" SERIAL PRIMARY KEY,
            "user_id" INTEGER UNIQUE REFERENCES "users"("id") ON DELETE SET NULL,
            "status" TEXT NOT NULL DEFAULT 'active',
            "source" TEXT NOT NULL DEFAULT 'contact',
            "first_name" TEXT,
            "last_name" TEXT,
            "middle_name" TEXT,
            "display_name" TEXT,
            "preferred_name" TEXT,
            "email" TEXT,
            "email_verified_at" TIMESTAMP WITH TIME ZONE,
            "phone" TEXT,
            "phone_verified_at" TIMESTAMP WITH TIME ZONE,
            "birth_date" DATE,
            "gender" TEXT,
            "pronouns" TEXT,
            "preferred_locale" TEXT,
            "timezone" TEXT,
            "country" TEXT,
            "avatar_url" TEXT,
            "bio" TEXT,
            "last_seen_at" TIMESTAMP WITH TIME ZONE,
            "archived_at" TIMESTAMP WITH TIME ZONE,
            "metadata" JSONB DEFAULT '{}'::jsonb,
            "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_people_email" ON "people" ("email")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_people_phone" ON "people" ("phone")`);

        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "person_relationships" (
            "id" SERIAL PRIMARY KEY,
            "from_person_id" INTEGER NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
            "to_person_id" INTEGER NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
            "type" TEXT NOT NULL,
            "metadata" JSONB DEFAULT '{}'::jsonb,
            "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_person_rel_from" ON "person_relationships" ("from_person_id")`);

        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "people_addresses" (
            "id" SERIAL PRIMARY KEY,
            "person_id" INTEGER NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
            "label" TEXT,
            "full_name" TEXT,
            "address_line1" TEXT,
            "address_line2" TEXT,
            "city" TEXT,
            "postal_code" TEXT,
            "country" TEXT,
            "phone" TEXT,
            "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
            "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_people_addr_person" ON "people_addresses" ("person_id")`);

        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "person_catalogs" (
            "id" SERIAL PRIMARY KEY,
            "kind" TEXT NOT NULL,
            "key" TEXT NOT NULL,
            "label" TEXT NOT NULL,
            "plugin_slug" TEXT,
            "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE ("kind", "key")
          )
        `);
      },
      sqlite: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "people" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "user_id" INTEGER UNIQUE REFERENCES "users"("id") ON DELETE SET NULL,
            "status" TEXT NOT NULL DEFAULT 'active',
            "source" TEXT NOT NULL DEFAULT 'contact',
            "first_name" TEXT,
            "last_name" TEXT,
            "middle_name" TEXT,
            "display_name" TEXT,
            "preferred_name" TEXT,
            "email" TEXT,
            "email_verified_at" DATETIME,
            "phone" TEXT,
            "phone_verified_at" DATETIME,
            "birth_date" DATE,
            "gender" TEXT,
            "pronouns" TEXT,
            "preferred_locale" TEXT,
            "timezone" TEXT,
            "country" TEXT,
            "avatar_url" TEXT,
            "bio" TEXT,
            "last_seen_at" DATETIME,
            "archived_at" DATETIME,
            "metadata" TEXT DEFAULT '{}',
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_people_email" ON "people" ("email")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_people_phone" ON "people" ("phone")`);

        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "person_relationships" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "from_person_id" INTEGER NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
            "to_person_id" INTEGER NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
            "type" TEXT NOT NULL,
            "metadata" TEXT DEFAULT '{}',
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_person_rel_from" ON "person_relationships" ("from_person_id")`);

        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "people_addresses" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "person_id" INTEGER NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
            "label" TEXT,
            "full_name" TEXT,
            "address_line1" TEXT,
            "address_line2" TEXT,
            "city" TEXT,
            "postal_code" TEXT,
            "country" TEXT,
            "phone" TEXT,
            "is_default" INTEGER NOT NULL DEFAULT 0,
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_people_addr_person" ON "people_addresses" ("person_id")`);

        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "person_catalogs" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "kind" TEXT NOT NULL,
            "key" TEXT NOT NULL,
            "label" TEXT NOT NULL,
            "plugin_slug" TEXT,
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE ("kind", "key")
          )
        `);
      },
      mysql: async () => {
        // Indexed or unique columns are bounded; everything else keeps the shape the other two use.
        // `email` and `phone` carry indexes, and ("kind","key") is a composite UNIQUE.
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "people" (
            "id" INT AUTO_INCREMENT PRIMARY KEY,
            "user_id" INT UNIQUE REFERENCES "users"("id") ON DELETE SET NULL,
            "status" VARCHAR(64) NOT NULL DEFAULT 'active',
            "source" VARCHAR(64) NOT NULL DEFAULT 'contact',
            "first_name" TEXT,
            "last_name" TEXT,
            "middle_name" TEXT,
            "display_name" TEXT,
            "preferred_name" TEXT,
            "email" VARCHAR(191),
            "email_verified_at" TIMESTAMP NULL,
            "phone" VARCHAR(64),
            "phone_verified_at" TIMESTAMP NULL,
            "birth_date" DATE,
            "gender" VARCHAR(64),
            "pronouns" VARCHAR(64),
            "preferred_locale" VARCHAR(32),
            "timezone" VARCHAR(64),
            "country" VARCHAR(64),
            "avatar_url" TEXT,
            "bio" TEXT,
            "last_seen_at" TIMESTAMP NULL,
            "archived_at" TIMESTAMP NULL,
            "metadata" JSON,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_people_email" ON "people" ("email")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_people_phone" ON "people" ("phone")`);

        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "person_relationships" (
            "id" INT AUTO_INCREMENT PRIMARY KEY,
            "from_person_id" INT NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
            "to_person_id" INT NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
            "type" VARCHAR(64) NOT NULL,
            "metadata" JSON,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_person_rel_from" ON "person_relationships" ("from_person_id")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_person_rel_to" ON "person_relationships" ("to_person_id")`);

        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "people_addresses" (
            "id" INT AUTO_INCREMENT PRIMARY KEY,
            "person_id" INT NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
            "label" VARCHAR(191),
            "full_name" TEXT,
            "address_line1" TEXT,
            "address_line2" TEXT,
            "city" VARCHAR(191),
            "postal_code" VARCHAR(32),
            "country" VARCHAR(64),
            "phone" VARCHAR(64),
            "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_people_addr_person" ON "people_addresses" ("person_id")`);

        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "person_catalogs" (
            "id" INT AUTO_INCREMENT PRIMARY KEY,
            "kind" VARCHAR(96) NOT NULL,
            "key" VARCHAR(96) NOT NULL,
            "label" VARCHAR(255) NOT NULL,
            "plugin_slug" VARCHAR(191),
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE ("kind", "key")
          )
        `);
      }
    });
  }

  async down(db: IDatabaseManager): Promise<void> {
    const tables = ['person_catalogs', 'people_addresses', 'person_relationships', 'people'];
    for (const table of tables) {
      await DialectHelper.executeForDialect(db.dialect, {
        postgres: async () => await db.execute(sql`DROP TABLE IF EXISTS "${sql.raw(table)}" CASCADE`),
        default: async () => await db.execute(sql`DROP TABLE IF EXISTS "${sql.raw(table)}"`)
      });
    }
  }
}
