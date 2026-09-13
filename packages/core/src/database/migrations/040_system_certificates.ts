import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { Logger } from '../../logging';

/**
 * Somewhere to keep a TLS certificate.
 *
 * Until now the platform knew which hosts it serves and nothing about how they are served over
 * HTTPS: certificates lived in whatever proxy an operator happened to run, per domain, by hand. That
 * is the step nobody should have to take — and an operator who has BOUGHT a certificate had nowhere
 * to put it at all.
 *
 * One row per exact host, matching the exact-host-only rule the rest of the platform already
 * applies: a certificate covering several names is stored against each host that uses it, so that
 * removing one host never quietly disarms another.
 *
 * PLATFORM-LEVEL, NOT TENANT-SCOPED. `_system_` prefixed tables are excluded from row-level security
 * by `TenantScopedTableDdl`, which is required here rather than incidental: whatever terminates TLS
 * reads every host's certificate at once, before any request exists and therefore before there is a
 * tenant to be scoped to. `tenant_id` is a reference for display and cascade only.
 *
 * The private key is stored ENCRYPTED (`private_key_enc`, via SecretService). The certificate itself
 * is not — it is handed to every visitor who opens the site, so encrypting it would protect nothing
 * and only make it unreadable when something goes wrong.
 */
export class SystemCertificatesMigration extends BaseMigration {
  readonly version = 40;
  readonly name = 'Store TLS certificates for the hosts the platform serves';

  private static readonly TABLE = '_system_certificates';
  private static readonly logger = new Logger({ namespace: 'SystemCertificatesMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const { TABLE, logger } = SystemCertificatesMigration;

    await db.execute(sql.raw(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (
        host TEXT PRIMARY KEY,
        tenant_id TEXT NULL REFERENCES _system_tenants(id) ON DELETE CASCADE,
        source TEXT NOT NULL DEFAULT 'uploaded',
        state TEXT NOT NULL DEFAULT 'no_certificate',
        certificate_pem TEXT NOT NULL DEFAULT '',
        private_key_enc TEXT NOT NULL DEFAULT '',
        issuer TEXT NOT NULL DEFAULT '',
        subject_alt_names JSONB NOT NULL DEFAULT '[]'::jsonb,
        serial TEXT NOT NULL DEFAULT '',
        fingerprint_sha256 TEXT NOT NULL DEFAULT '',
        not_before TIMESTAMPTZ NULL,
        not_after TIMESTAMPTZ NULL,
        last_error TEXT NOT NULL DEFAULT '',
        last_attempt_at TIMESTAMPTZ NULL,
        next_attempt_at TIMESTAMPTZ NULL,
        attempts_in_window INTEGER NOT NULL DEFAULT 0,
        last_warned_days INTEGER NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ));

    // The expiry sweep asks "what runs out soonest" on every run, and the admin's platform-wide list
    // orders by the same column.
    await db.execute(sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_${TABLE}_not_after ON ${TABLE} (not_after)`,
    ));
    // A site's own page asks for just its hosts.
    await db.execute(sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_${TABLE}_tenant ON ${TABLE} (tenant_id)`,
    ));

    logger.info(
      `${TABLE} created. No certificate is issued or assumed by this migration: every host starts with `
      + 'no certificate until an operator uploads one.',
    );
  }
}
