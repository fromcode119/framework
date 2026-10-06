import type { IDatabaseManager } from '@fromcode119/database';
import { SystemConstants } from '@fromcode119/core';

/**
 * Which sites still owe their first content — their theme's seed, their plugins' seeds and default
 * pages — because the site was created before this process could write for it.
 *
 * Whether a deployment runs sites is decided at boot. Until then nothing binds a write to a site, so
 * everything a creation seeds lands with no owner: row-level security hides it from the site the moment
 * the api restarts into multi-site mode, and the site comes up without its home page. The FIRST site is
 * always created in that state (its creation is what turns sites on). So creation records the debt here
 * and the next boot, which can write for the site, pays it.
 *
 * Stored on the platform's `_system_meta` with the site's id on the row, written on the OWNER connection
 * (the request connection cannot place a row under a site that does not exist for it yet). The row is
 * the whole state: it exists while the debt does, and is deleted once the boot step has run.
 */
export class PendingSiteSeed {
  private static readonly KEY = 'site_content_seed_owed';

  constructor(private readonly ownerDb: IDatabaseManager) {}

  async mark(tenantId: string): Promise<void> {
    await this.ownerDb.queryRaw(
      `INSERT INTO "${SystemConstants.TABLE.META}" ("key", "value", "description", "tenant_id") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [PendingSiteSeed.KEY, '1', 'The site was created before multi-site mode was on, so its theme seed and default pages run at the next boot.', tenantId],
    );
  }

  /**
   * Whether this site owes its content. Read inside the site's own scope: `_system_meta` has forced
   * row-level security, so even the owner connection sees a site's row only while that site is bound.
   */
  async isOwed(tenantId: string): Promise<boolean> {
    return this.ownerDb.withTenant(tenantId, async () => {
      const rows = await this.ownerDb.queryRaw(
        `SELECT 1 FROM "${SystemConstants.TABLE.META}" WHERE "key" = $1 AND "tenant_id" = $2`,
        [PendingSiteSeed.KEY, tenantId],
      );
      return rows.length > 0;
    });
  }

  async clear(tenantId: string): Promise<void> {
    await this.ownerDb.withTenant(tenantId, () => this.ownerDb.queryRaw(
      `DELETE FROM "${SystemConstants.TABLE.META}" WHERE "key" = $1 AND "tenant_id" = $2`,
      [PendingSiteSeed.KEY, tenantId],
    ));
  }
}
