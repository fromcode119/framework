import { BaseMigration, IDatabaseManager } from '@fromcode119/database';
import { Logger } from '@core/logging';

/**
 * Stamps the owning site onto certificate rows that were created without one.
 *
 * A certificate's `tenant_id` decides WHOSE Cloudflare token its DNS-01 orders use: the resolver
 * asks for the record's owner first and falls back to the platform's. `upload` and `storeIssued`
 * always stamped it, but choosing "Automatic" in the admin did not — so every record born that way
 * was left unowned, and unowned means the platform's token, forever.
 *
 * `CertificateStoreService.setSource` stamps it now. This is for the rows that already exist: they
 * are never rewritten by anything, so without a backfill they keep silently using the wrong
 * credential. Observed in production — a site saved its own token, the order still went out under
 * the platform's, and the only clue was the "(tried the platform's Cloudflare token)" suffix on the
 * failure. The fix worked; the row predated it.
 *
 * MATCHED THE SAME WAY THE PLATFORM DECIDES HOST OWNERSHIP: a tenant's `primary_host`, or one of its
 * `host_aliases`. A host that matches no tenant is left NULL, which is the correct answer — the
 * platform's own hostnames belong to no site, and so does a domain held only to carry a wildcard.
 *
 * IDEMPOTENT AND SELF-LIMITING. Only rows with a NULL owner are considered, so a deployment whose
 * rows are already stamped finds nothing and does nothing. It never overwrites an existing owner:
 * a stamped row is the one piece of evidence about who asked for that certificate.
 */
export class CertificateOwnerBackfillMigration extends BaseMigration {
  readonly version = 51;
  readonly name = 'Stamp the owning site onto certificate rows created without one';

  private static readonly CERTIFICATES = '_system_certificates';
  private static readonly TENANTS = '_system_tenants';
  private static readonly logger = new Logger({ namespace: 'CertificateOwnerBackfillMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const { CERTIFICATES, TENANTS, logger } = CertificateOwnerBackfillMigration;

    // An installation without these tables yet has nothing to repair — a fresh install writes the
    // owner from the start. Reading is how that is established: there is no portable table-exists
    // helper here, and a missing table simply raises.
    let unowned: Array<Record<string, unknown>>;
    let tenants: Array<Record<string, unknown>>;
    try {
      unowned = await db.queryRaw(`SELECT host FROM ${CERTIFICATES} WHERE tenant_id IS NULL`);
      if (!unowned.length) return;
      tenants = await db.queryRaw(`SELECT id, primary_host, host_aliases FROM ${TENANTS}`);
    } catch {
      return;
    }

    const owners = CertificateOwnerBackfillMigration.hostOwners(tenants);
    let stamped = 0;

    for (const row of unowned) {
      const host = String(row.host ?? '').trim().toLowerCase();
      const owner = owners.get(host);
      // No tenant claims this host. NULL is the right answer, not a failure: the platform's own
      // hostnames belong to no site, and neither does a domain held only to carry a wildcard.
      if (!owner) continue;

      // Through the query builder, so the values are parameterised and the statement is whatever
      // this dialect writes — never a hand-built string carrying data from another table.
      // `tenant_id IS NULL` stays in the filter so a concurrent stamp is never overwritten.
      await db.update(CERTIFICATES, { host, tenant_id: null }, { tenant_id: owner });
      stamped += 1;
      logger.info(`Certificate for ${host} now belongs to site ${owner}.`);
    }

    if (stamped > 0) {
      logger.info(`Stamped ${stamped} certificate row(s) with their owning site; ${unowned.length - stamped} belong to no site.`);
    }
  }

  /** host -> tenant id, from each tenant's primary host and its aliases. */
  private static hostOwners(tenants: Array<Record<string, unknown>>): Map<string, string> {
    const owners = new Map<string, string>();

    for (const tenant of tenants) {
      const id = String(tenant.id ?? '').trim();
      if (!id) continue;

      for (const host of CertificateOwnerBackfillMigration.hostsOf(tenant)) {
        // First claim wins. Two tenants cannot legitimately share a host, and if a deployment has
        // somehow reached that state, silently reassigning a certificate is the wrong repair.
        if (!owners.has(host)) owners.set(host, id);
      }
    }

    return owners;
  }

  /** Every host a tenant answers on. `host_aliases` is JSON text on some dialects, an array on others. */
  private static hostsOf(tenant: Record<string, unknown>): string[] {
    const hosts = [String(tenant.primary_host ?? '')];
    const raw = tenant.host_aliases;

    if (Array.isArray(raw)) {
      hosts.push(...raw.map((alias) => String(alias)));
    } else if (typeof raw === 'string' && raw.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) hosts.push(...parsed.map((alias) => String(alias)));
      } catch {
        // A malformed aliases value is not this migration's to repair; the primary host still counts.
      }
    }

    return hosts.map((host) => host.trim().toLowerCase()).filter((host) => host.length > 0);
  }
}
