import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '../helpers/dialect';
import { PortableColumnTypes } from '../helpers/portable-column-types';
import { Logger } from '../../logging';

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
export class CertificateDnsChallengeMigration extends BaseMigration {
  readonly version = 47;
  readonly name = 'Record which challenge a certificate was ordered with, and whether it is a wildcard';

  private static readonly TABLE = '_system_certificates';
  private static readonly CHALLENGE_COLUMN = 'challenge';
  private static readonly WILDCARD_COLUMN = 'wildcard';
  private static readonly logger = new Logger({ namespace: 'CertificateDnsChallengeMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const { TABLE, CHALLENGE_COLUMN, WILDCARD_COLUMN, logger } = CertificateDnsChallengeMigration;
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

  /** Whether the column is already there. SQLite answers with PRAGMA and errors on information_schema. */
  private async hasColumn(db: IDatabaseManager, table: string, column: string): Promise<boolean> {
    let present = false;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = CertificateDnsChallengeMigration.hasRow(await db.execute(sql.raw(
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
        present = CertificateDnsChallengeMigration.hasRow(await db.execute(sql.raw(
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
}
