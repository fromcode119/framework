import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';
import { Logger } from '@core/logging';

/**
 * Somewhere to record that a site's own people may look at it before it is published.
 *
 * `TenantVisibility.PRIVATE` has always PROMISED this — "the site's own admins see the real thing,
 * so it can be built and reviewed before launch" — and the storefront never kept it. It could not:
 * the admin's session cookie is host-scoped, so it is never sent to the site's host, and on a
 * customer's own apex domain there is no shared domain to send it on. The operator got the same
 * holding page as a stranger, on the site they were being asked to build.
 *
 * This table is the handoff. The admin mints a one-time GRANT for one site; the operator's browser
 * spends it on that site's host and gets a SESSION cookie back for the same row. Two secrets, one
 * row, so revoking the row ends both.
 *
 * PLATFORM-LEVEL, NOT TENANT-SCOPED. `_system_` prefixed tables are excluded from row-level security
 * by `TenantScopedTables`, which is required rather than incidental here: the grant is written on
 * the admin host, where the request is bound to whichever site the operator is currently inside —
 * frequently not the one being previewed, and on the Sites registry, not any of them. `tenant_id` is
 * the binding instead, and it is compared on every read.
 *
 * ONLY HASHES ARE STORED. Neither secret can be read back out, so a database copy is not a set of
 * working preview links. Rows are short-lived and the sweep that spends them also drops what has
 * lapsed; nothing here accumulates.
 */
export class SitePreviewGrantsMigration extends BaseMigration {
  readonly version = 42;
  readonly name = 'Let a site\'s own people preview it before it is published';

  private static readonly TABLE = '_system_site_preview_grants';
  private static readonly logger = new Logger({ namespace: 'SitePreviewGrantsMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const { TABLE, logger } = SitePreviewGrantsMigration;
    const type = PortableColumnTypes.for(db.dialect);

    await db.execute(sql.raw(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (
        id ${type.key} PRIMARY KEY,
        tenant_id ${type.key} NOT NULL REFERENCES _system_tenants(id) ON DELETE CASCADE,
        user_id ${type.key} NOT NULL,
        token_hash ${type.key} NOT NULL UNIQUE,
        expires_at ${type.timestamp} NOT NULL,
        -- The single-use lock, and NOT NULL for a reason the whole feature rests on: the claim is an
        -- UPDATE whose WHERE says "only if unspent", and on the raw system-table path a null in a
        -- WHERE compiles to an equality against NULL, which matches nothing. consumed_at records
        -- when; this records whether. See SitePreviewGrantState.
        state ${type.shortText} NOT NULL DEFAULT 'issued',
        consumed_at ${type.timestamp} NULL,
        session_hash ${type.key} NULL UNIQUE,
        session_expires_at ${type.timestamp} NULL,
        created_at ${type.timestamp} NOT NULL DEFAULT ${type.now}
      )`,
    ));

    // Both secrets are looked up by hash, on the hot path: the session hash is read on every
    // storefront request that carries a preview cookie.
    await db.execute(sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_${TABLE}_session ON ${TABLE} (session_hash)`,
    ));
    // The sweep asks "what has lapsed"; a site's own row set is asked for when access is withdrawn.
    await db.execute(sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_${TABLE}_tenant ON ${TABLE} (tenant_id)`,
    ));

    logger.info(
      `${TABLE} created. No preview is granted by this migration: a site stays closed to everyone `
      + 'until one of its administrators asks for a link.',
    );
  }
}
