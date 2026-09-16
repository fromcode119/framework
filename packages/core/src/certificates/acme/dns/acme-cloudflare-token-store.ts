import { SecretService } from '@core/security/secret-service';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The one write path for the Cloudflare API token, encrypted at rest.
 *
 * `_system_meta` rows are written in the clear by the generic settings PUT — fine for a directory
 * URL or an address, wrong for a credential with DNS edit rights. This is the same split the
 * platform already draws for integration provider secrets: the generic settings key is declared
 * NOT writable/exposed (see `SystemSettingRegistry`), and this is the only place that reads or
 * writes the row, always through `SecretService`. `AcmeSettings` reads the row back through the
 * ordinary platform-settings accessor and decrypts it; nothing else ever sees the plaintext.
 *
 * PLATFORM-SCOPED, like every other ACME setting: written and read under `withPlatformAdmin` so the
 * row lands at `tenant_id IS NULL` regardless of which site (if any) the request is bound to —
 * mirrors `McpTokenStore`'s platform-partition writes for the same reason.
 */
export class AcmeCloudflareTokenStore {
  private static readonly TABLE = SystemConstants.TABLE.META;
  private static readonly KEY = SystemConstants.META_KEY.CERTIFICATE_ACME_CLOUDFLARE_TOKEN;

  constructor(private readonly db: any) {}

  /** Store the token encrypted. Never logged, never echoed back. */
  async set(token: string): Promise<void> {
    const trimmed = String(token ?? '').trim();
    if (!trimmed) {
      await this.clear();
      return;
    }
    if (!SecretService.isEncryptionAvailable()) {
      throw new Error('Storing the Cloudflare token requires SECRET_KEY to be configured on the server.');
    }
    await this.write(SecretService.encrypt(trimmed));
  }

  /** Blank means DNS-01 is unavailable — clearing the row is how that is expressed. */
  async clear(): Promise<void> {
    await this.write('');
  }

  private async write(value: string): Promise<void> {
    await this.db.withPlatformAdmin(async () => {
      const existing = await this.db.findOne(AcmeCloudflareTokenStore.TABLE, { key: AcmeCloudflareTokenStore.KEY });
      if (existing) {
        await this.db.update(AcmeCloudflareTokenStore.TABLE, { key: AcmeCloudflareTokenStore.KEY }, { value, updated_at: new Date() });
        return;
      }
      await this.db.insert(AcmeCloudflareTokenStore.TABLE, { key: AcmeCloudflareTokenStore.KEY, value });
    });
  }
}
