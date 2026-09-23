import { DialectHelper } from '@core/database/helpers/dialect';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';
import { Logger } from '@core/logging';
import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';

/**
 * TLS certificates for the hosts the platform serves.
 *
 * The certificates themselves, each owned by the site whose host it covers; the ACME accounts and
 * challenge tokens needed to obtain one automatically rather than be handed one; and, per certificate,
 * which challenge it was ordered with and whether it covers the wildcard.
 *
 * Versions 40, 41, 47 and 51 consolidated. A database that ran them has all four recorded and runs
 * nothing here. 51 only stamped an owner onto rows created without one; a fresh install writes the
 * owner from the start, so it has no step here.
 */
export class CertificatesMigration extends BaseMigration {
  readonly version = 40;
  readonly name = 'TLS certificates, ACME accounts and challenges';

  async up(db: IDatabaseManager): Promise<void> {
    await this.v040SystemCertificates(db);
    await this.v041AcmeAccountsAndChallenges(db);
    await this.v047CertificateDnsChallenge(db);
  }

  private static readonly TABLE = '_system_certificates';

  private static readonly logger = new Logger({ namespace: 'CertificatesMigration' });


  private static readonly ACCOUNTS = '_system_acme_accounts';

  private static readonly CHALLENGES = '_system_acme_challenges';

  private static readonly loggerV41 = new Logger({ namespace: 'CertificatesMigration' });


  private static readonly TABLE_V47 = '_system_certificates';

  private static readonly CHALLENGE_COLUMN = 'challenge';

  private static readonly WILDCARD_COLUMN = 'wildcard';

  private static readonly loggerV47 = new Logger({ namespace: 'CertificatesMigration' });


  /** Whether the column is already there. SQLite answers with PRAGMA and errors on information_schema. */
  private async hasColumn(db: IDatabaseManager, table: string, column: string): Promise<boolean> {
    let present = false;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = CertificatesMigration.hasRow(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.columns
            WHERE table_name = '${table}' AND column_name = '${column}'`,
        )));
      },
      sqlite: async () => {
        const result: any = await db.execute(sql.raw(`PRAGMA table_info(${table})`));
        const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
        present = rows.some((row: any) => String(row?.name || '') === column);
      },
      mysql: async () => {
        present = CertificatesMigration.hasRow(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = '${table}' AND column_name = '${column}'`,
        )));
      },
    });

    return present;
  }


  private static hasRow(result: any): boolean {
    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    return rows.length > 0;
  }

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
  private async v040SystemCertificates(db: IDatabaseManager): Promise<void> {
    const { TABLE, logger } = CertificatesMigration;
    // One column list, spelled for whichever driver this deployment runs on. See PortableColumnTypes
    // for why the types are resolved rather than the whole statement being written out twice.
    const type = PortableColumnTypes.for(db.dialect);

    await db.execute(sql.raw(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (
        host ${type.key} PRIMARY KEY,
        tenant_id ${type.key} NULL,
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
        updated_at ${type.timestamp} NOT NULL DEFAULT ${type.now},
        FOREIGN KEY (tenant_id) REFERENCES _system_tenants(id) ON DELETE CASCADE
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

  /**
   * What the platform needs to obtain a certificate rather than be handed one.
   *
   * Two tables, both platform-level and neither tenant-scoped — the same reasoning as
   * `_system_certificates`: an order is placed by the platform for a host, before any request exists
   * and therefore before there is a tenant to scope to.
   *
   * ACCOUNTS ARE KEYED BY DIRECTORY URL, one row per authority, and reused forever. Certificate
   * authorities cap how many new accounts a single address may register in a window; a deployment that
   * registered a fresh account per order would work for a while and then be refused for a reason that
   * looks nothing like its cause. Keying by directory is also what lets an operator move between a
   * staging authority and a production one without losing either account.
   *
   * The account's private key is encrypted at rest like every other key here. The CHALLENGE rows are
   * not: a key authorization is served to anyone who asks for it, by design — that is how the
   * authority proves the host is ours.
   */
  private async v041AcmeAccountsAndChallenges(db: IDatabaseManager): Promise<void> {
    const { ACCOUNTS, CHALLENGES, loggerV41: logger } = CertificatesMigration;
    const type = PortableColumnTypes.for(db.dialect);

    await db.execute(sql.raw(
      `CREATE TABLE IF NOT EXISTS ${ACCOUNTS} (
        directory_url ${type.key} PRIMARY KEY,
        account_url ${type.longTextNullable},
        private_key_enc ${type.longTextNullable},
        contact ${type.longTextNullable},
        created_at ${type.timestamp} NOT NULL DEFAULT ${type.now}
      )`,
    ));

    await db.execute(sql.raw(
      `CREATE TABLE IF NOT EXISTS ${CHALLENGES} (
        token ${type.key} PRIMARY KEY,
        host ${type.key} NOT NULL,
        key_authorization TEXT NOT NULL,
        expires_at ${type.timestamp} NOT NULL
      )`,
    ));

    // The sweep deletes what has expired rather than letting tokens accumulate for the life of the
    // deployment; a token is useless the moment its order finishes either way.
    await db.execute(sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_${CHALLENGES}_expires ON ${CHALLENGES} (expires_at)`,
    ));

    logger.info(
      `${ACCOUNTS} and ${CHALLENGES} created. No account is registered and no certificate is ordered `
      + 'by this migration: automatic issuance stays off until an operator names an authority.',
    );
  }

  /**
   * Which challenge a certificate was ordered with, and whether it covers the wildcard.
   *
   * Until now the platform's own ACME client only ever spoke HTTP-01 for one exact name — so
   * `_system_certificates` had nothing to say about either question. This is Phase 1 of DNS-01: the
   * columns exist and are read/written, but no order is placed with `challenge = 'dns-01'` until the
   * admin actually chooses that variant of Automatic (`CertificateAdminService.setSource`) and a
   * Cloudflare token is configured — every EXISTING row defaults to exactly what it already is,
   * `'http-01'` / not wildcard, because that is the only kind of certificate this platform has ever
   * issued itself.
   *
   * `challenge` decides which preflight `CertificateIssuanceService` runs (DNS reachability for
   * http-01; a Cloudflare zone check for dns-01) — the two are not interchangeable, and running the
   * wrong one either blocks a working DNS-only host or lets a broken one through.
   *
   * `wildcard` decides whether the order asks for `*.<host>` as an additional name — see
   * `AcmeClientAdapter.issue`'s `altNames`.
   */
  private async v047CertificateDnsChallenge(db: IDatabaseManager): Promise<void> {
    const { TABLE_V47: TABLE, CHALLENGE_COLUMN, WILDCARD_COLUMN, loggerV47: logger } = CertificatesMigration;
    const type = PortableColumnTypes.for(db.dialect);

    if (!(await this.hasColumn(db, TABLE, CHALLENGE_COLUMN))) {
      await DialectHelper.executeForDialect(db.dialect, {
        postgres: async () => {
          await db.execute(sql.raw(
            `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS ${CHALLENGE_COLUMN} ${type.shortText} NOT NULL DEFAULT 'http-01'`,
          ));
        },
        sqlite: async () => {
          await db.execute(sql.raw(
            `ALTER TABLE ${TABLE} ADD COLUMN ${CHALLENGE_COLUMN} ${type.shortText} NOT NULL DEFAULT 'http-01'`,
          ));
        },
        mysql: async () => {
          await db.execute(sql.raw(
            `ALTER TABLE ${TABLE} ADD COLUMN ${CHALLENGE_COLUMN} ${type.shortText} NOT NULL DEFAULT 'http-01'`,
          ));
        },
      });
    }

    if (!(await this.hasColumn(db, TABLE, WILDCARD_COLUMN))) {
      await DialectHelper.executeForDialect(db.dialect, {
        postgres: async () => {
          await db.execute(sql.raw(
            `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS ${WILDCARD_COLUMN} BOOLEAN NOT NULL DEFAULT ${type.boolFalse}`,
          ));
        },
        sqlite: async () => {
          await db.execute(sql.raw(
            `ALTER TABLE ${TABLE} ADD COLUMN ${WILDCARD_COLUMN} BOOLEAN NOT NULL DEFAULT ${type.boolFalse}`,
          ));
        },
        mysql: async () => {
          await db.execute(sql.raw(
            `ALTER TABLE ${TABLE} ADD COLUMN ${WILDCARD_COLUMN} BOOLEAN NOT NULL DEFAULT ${type.boolFalse}`,
          ));
        },
      });
    }

    logger.info(
      `${TABLE}.${CHALLENGE_COLUMN} and ${TABLE}.${WILDCARD_COLUMN} added. Every existing row reads `
      + "'http-01' / not wildcard — the only kind of certificate this platform has issued so far — "
      + 'and nothing is ordered differently until an operator chooses the DNS-01 wildcard variant of Automatic.',
    );
  }

}
