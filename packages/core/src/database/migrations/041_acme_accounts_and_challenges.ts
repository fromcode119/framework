import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { Logger } from '../../logging';

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
export class AcmeAccountsAndChallengesMigration extends BaseMigration {
  readonly version = 41;
  readonly name = 'Accounts and challenge tokens for automatic certificates';

  private static readonly ACCOUNTS = '_system_acme_accounts';
  private static readonly CHALLENGES = '_system_acme_challenges';
  private static readonly logger = new Logger({ namespace: 'AcmeAccountsAndChallengesMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const { ACCOUNTS, CHALLENGES, logger } = AcmeAccountsAndChallengesMigration;

    await db.execute(sql.raw(
      `CREATE TABLE IF NOT EXISTS ${ACCOUNTS} (
        directory_url TEXT PRIMARY KEY,
        account_url TEXT NOT NULL DEFAULT '',
        private_key_enc TEXT NOT NULL DEFAULT '',
        contact TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ));

    await db.execute(sql.raw(
      `CREATE TABLE IF NOT EXISTS ${CHALLENGES} (
        token TEXT PRIMARY KEY,
        host TEXT NOT NULL,
        key_authorization TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
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
}
