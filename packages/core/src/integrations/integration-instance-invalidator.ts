import { RequestContextUtils } from '@core/context/request-context';
import { IntegrationTenantAccess } from '@core/integrations/integration-tenant-access';

/**
 * Drops the cached integration instances a configuration write has made stale.
 *
 * A site's integration is resolved on its first use and kept for the life of the process. Saving that
 * site's settings refreshed only the PLATFORM instance, so the site went on using what it resolved
 * before the save — a mail driver answering "no mail configuration" after an operator had just added
 * SMTP — until the api restarted. A write inside a site scope forgets that site's copies; a
 * platform-level write forgets every site's, because a site sending through the platform holds the
 * old platform instance in its own entry.
 *
 * It works on the manager's OWN instance map (keys `<tenantId>::<type>`), passed in rather than copied,
 * so there is exactly one cache to clear.
 */
export class IntegrationInstanceInvalidator {
  constructor(private readonly instances: Map<string, unknown>) {}

  /** Called after every configuration write, inside the scope the write ran in. */
  forget(normalizedType: string): void {
    const tenantId = String(RequestContextUtils.getTenantId() ?? '').trim();
    if (tenantId) {
      this.instances.delete(`${tenantId}::${normalizedType}`);
      IntegrationTenantAccess.invalidate(tenantId);
      return;
    }
    for (const key of [...this.instances.keys()]) {
      if (key.endsWith(`::${normalizedType}`)) this.instances.delete(key);
    }
    IntegrationTenantAccess.invalidate();
  }
}
