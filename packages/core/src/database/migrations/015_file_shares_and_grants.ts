import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * Delivery of private files to named recipients.
 *
 * A SHARE is the send — the files, the covering message, and the policy the operator chose. A GRANT is
 * one recipient's access to that share, and it carries its OWN token. That split is the whole point: a
 * single anonymous link cannot tell you who opened it and cannot be withdrawn from one person without
 * withdrawing it from everyone. Per-recipient tokens make both possible.
 *
 * Only `sha256(token)` is stored. The raw value is returned once, at creation, and is not recoverable
 * afterwards — an operator who loses a link reissues it rather than reading it back, and a leaked
 * database yields no working links.
 *
 * Timestamps are compared in JS, never in SQL. On SQLite a `datetime('now')` default and an ISO string
 * written from the application sort differently ('T' > ' '), so a WHERE on expiry silently matches the
 * wrong rows. The reader loads the row and decides; these columns are storage, not query predicates.
 *
 * `media_ids` is a JSON array rather than a junction table: a share's files are only ever read as a
 * whole, so the join would buy nothing today. The cost is that "which shares contain this file" needs a
 * scan — worth revisiting if media deletion grows an integrity check.
 */
export class FileSharesAndGrantsMigration extends BaseMigration {
  readonly version = 15;
  readonly name = 'Create _system_file_shares, _system_file_grants and _system_file_access_log';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_file_shares" (
            "id" SERIAL PRIMARY KEY,
            "title" TEXT NOT NULL,
            "message" TEXT DEFAULT '',
            "media_ids" TEXT NOT NULL DEFAULT '[]',
            "created_by" INTEGER,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_file_grants" (
            "id" SERIAL PRIMARY KEY,
            "share_id" INTEGER NOT NULL,
            "email" TEXT NOT NULL,
            "user_id" INTEGER,
            "token_hash" TEXT NOT NULL,
            "expires_at" TIMESTAMP,
            "max_downloads" INTEGER NOT NULL DEFAULT 0,
            "download_count" INTEGER NOT NULL DEFAULT 0,
            "require_confirmation" BOOLEAN NOT NULL DEFAULT FALSE,
            "require_account" BOOLEAN NOT NULL DEFAULT FALSE,
            "revoked_at" TIMESTAMP,
            "last_access_at" TIMESTAMP,
            "last_access_ip" TEXT,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_file_access_log" (
            "id" SERIAL PRIMARY KEY,
            -- NULLABLE on purpose. An attempt with an unknown token has no grant to point at, and that
            -- is precisely the row worth keeping: a run of them is someone guessing. NOT NULL here made
            -- the insert throw, which turned the deliberately-generic refusal into a 500 — an oracle
            -- distinguishing "no such token" from every other refusal.
            "grant_id" INTEGER,
            "media_id" INTEGER,
            "outcome" TEXT NOT NULL,
            "ip" TEXT,
            "user_agent" TEXT,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "idx_file_grants_token_hash" ON "_system_file_grants" ("token_hash")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_file_grants_share" ON "_system_file_grants" ("share_id")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_file_grants_email" ON "_system_file_grants" ("email")`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_file_access_log_grant" ON "_system_file_access_log" ("grant_id")`);
      },
      mysql: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS _system_file_shares (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title TEXT NOT NULL,
            message TEXT,
            media_ids TEXT NOT NULL,
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `));
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS _system_file_grants (
            id INT AUTO_INCREMENT PRIMARY KEY,
            share_id INT NOT NULL,
            email VARCHAR(320) NOT NULL,
            user_id INT,
            token_hash VARCHAR(64) NOT NULL,
            expires_at TIMESTAMP NULL,
            max_downloads INT NOT NULL DEFAULT 0,
            download_count INT NOT NULL DEFAULT 0,
            require_confirmation TINYINT(1) NOT NULL DEFAULT 0,
            require_account TINYINT(1) NOT NULL DEFAULT 0,
            revoked_at TIMESTAMP NULL,
            last_access_at TIMESTAMP NULL,
            last_access_ip VARCHAR(64),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY idx_file_grants_token_hash (token_hash),
            KEY idx_file_grants_share (share_id),
            KEY idx_file_grants_email (email)
          )
        `));
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS _system_file_access_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            grant_id INT,
            media_id INT,
            outcome VARCHAR(32) NOT NULL,
            ip VARCHAR(64),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_file_access_log_grant (grant_id)
          )
        `));
      },
      sqlite: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_file_shares" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "title" TEXT NOT NULL,
            "message" TEXT DEFAULT '',
            "media_ids" TEXT NOT NULL DEFAULT '[]',
            "created_by" INTEGER,
            "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `));
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_file_grants" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "share_id" INTEGER NOT NULL,
            "email" TEXT NOT NULL,
            "user_id" INTEGER,
            "token_hash" TEXT NOT NULL,
            "expires_at" TEXT,
            "max_downloads" INTEGER NOT NULL DEFAULT 0,
            "download_count" INTEGER NOT NULL DEFAULT 0,
            "require_confirmation" INTEGER NOT NULL DEFAULT 0,
            "require_account" INTEGER NOT NULL DEFAULT 0,
            "revoked_at" TEXT,
            "last_access_at" TEXT,
            "last_access_ip" TEXT,
            "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `));
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_file_access_log" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "grant_id" INTEGER,
            "media_id" INTEGER,
            "outcome" TEXT NOT NULL,
            "ip" TEXT,
            "user_agent" TEXT,
            "created_at" TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `));
        await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_file_grants_token_hash" ON "_system_file_grants" ("token_hash")`));
        await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "idx_file_grants_share" ON "_system_file_grants" ("share_id")`));
        await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "idx_file_grants_email" ON "_system_file_grants" ("email")`));
        await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "idx_file_access_log_grant" ON "_system_file_access_log" ("grant_id")`));
      },
    });
  }
}
