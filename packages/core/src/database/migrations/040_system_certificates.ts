import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';
import { Logger } from '@core/logging';

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
 * by `TenantScopedTables`, which is required here rather than incidental: whatever terminates TLS
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
    // One column list, spelled for whichever driver this deployment runs on. See PortableColumnTypes
    // for why the types are resolved rather than the whole statement being written out twice.
    const type = PortableColumnTypes.for(db.dialect);

    await db.execute(sql.raw(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (
        host ${type.key} PRIMARY KEY,
        tenant_id ${type.key} NULL REFERENCES _system_tenants(id) ON DELETE CASCADE,
        source ${type.shortText} NOT NULL DEFAULT 'uploaded',
        state ${type.shortText} NOT NULL DEFAULT 'no_certificate',
        certificate_pem ${type.longTextNullable},
        private_key_enc ${type.longTextNullable},
        issuer ${type.shortText} NOT NULL DEFAULT '',
        subject_alt_names ${type.json} NOT NULL DEFAULT ${type.jsonEmptyArray},
        serial ${type.shortText} NOT NULL DEFAULT '',
        fingerprint_sha256 ${type.shortText} NOT NULL DEFAULT '',
        not_before ${type.timestamp} NULL,
        not_after ${type.timestamp} NULL,
        last_error ${type.longTextNullable},
        last_attempt_at ${type.timestamp} NULL,
        next_attempt_at ${type.timestamp} NULL,
        attempts_in_window INTEGER NOT NULL DEFAULT 0,
        last_warned_days INTEGER NULL,
        updated_at ${type.timestamp} NOT NULL DEFAULT ${type.now}
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
