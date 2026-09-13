import { SecretService } from '@core/security/secret-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The platform's account with one certificate authority.
 *
 * ONE ROW PER DIRECTORY URL, CREATED ONCE AND REUSED FOREVER. Authorities cap how many new accounts
 * a single address may register in a window, so a deployment that registered per order would work
 * for a while and then start being refused for a reason that looks nothing like its cause. Keying by
 * directory is also what lets an operator move between a test authority and a production one and
 * back without losing either account.
 *
 * The account key is encrypted at rest, like every other private key the platform holds. Losing it
 * is not fatal — a new account can be registered — but it identifies us to the authority, and an
 * account key in the clear is an account somebody else can act as.
 */
export class AcmeAccountStore {
  private static readonly TABLE = SystemConstants.TABLE.ACME_ACCOUNTS;

  constructor(private readonly db: any) {}

  /** The stored account for a directory, with its key decrypted, or null when there is none yet. */
  async find(directoryUrl: string): Promise<{ accountUrl: string; privateKeyPem: string; contact: string } | null> {
    const row = await this.db.findOne(AcmeAccountStore.TABLE, { directory_url: String(directoryUrl) });
    if (!row) return null;
    const encrypted = String(row.private_key_enc ?? '').trim();
    if (!encrypted) return null;
    return {
      accountUrl: String(row.account_url ?? ''),
      privateKeyPem: SecretService.decrypt(encrypted),
      contact: String(row.contact ?? ''),
    };
  }

  /**
   * Remember an account.
   *
   * Refuses to store a key this installation cannot encrypt, rather than writing one in the clear —
   * the same rule the certificate store applies.
   */
  async save(directoryUrl: string, accountUrl: string, privateKeyPem: string, contact: string): Promise<void> {
    if (!SecretService.isEncryptionAvailable()) {
      throw new Error('Storing an account key requires SECRET_KEY (or INTEGRATION_SECRET_KEY) to be configured on the server.');
    }

    const key = String(directoryUrl);
    const payload = {
      account_url: String(accountUrl ?? ''),
      private_key_enc: SecretService.encrypt(privateKeyPem),
      contact: String(contact ?? ''),
    };
    const existing = await this.db.findOne(AcmeAccountStore.TABLE, { directory_url: key });
    if (existing) {
      await this.db.update(AcmeAccountStore.TABLE, { directory_url: key }, payload);
      return;
    }
    await this.db.insert(AcmeAccountStore.TABLE, { directory_url: key, ...payload, created_at: new Date() });
  }

  /** What the admin may see: which authority, registered when. Never the key. */
  async describe(directoryUrl: string): Promise<{ accountUrl: string; createdAt: string | null } | null> {
    const row = await this.db.findOne(AcmeAccountStore.TABLE, { directory_url: String(directoryUrl) });
    if (!row) return null;
    const createdAt = row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at));
    return {
      accountUrl: String(row.account_url ?? ''),
      createdAt: Number.isNaN(createdAt.getTime()) ? null : createdAt.toISOString(),
    };
  }
}
