import { RequestContextUtils } from '@core/context/request-context';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { SiteLocaleAccess } from '@core/i18n/site-locale-access';
import { PluginPlatformReceivers } from '@core/plugin/platform/plugin-platform-receivers';
import { PluginPlatformDeliveryReason } from '@core/plugin/platform/enums/plugin-platform-delivery-reason.enum';
import type { IPluginPlatformDeliveryResult } from '@core/plugin/platform/interfaces/plugin-platform-delivery-result.interface';

/**
 * Hands what a plugin's platform part received to the TENANT part that owns it.
 *
 * The owner's receiver runs inside the owner's isolation — its tenant bound in the request store and
 * its connection bound for row-level security — exactly as a scheduled task for that site runs, so
 * whatever it reads and writes is that site's and nobody else's. A site that switched the plugin off
 * receives nothing: the delivery is dropped, not queued.
 */
export class PluginPlatformDelivery {
  constructor(private readonly db: { withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> }) {}

  async deliver(slug: string, tenantId: string | null, payload: unknown): Promise<IPluginPlatformDeliveryResult> {
    const receiver = PluginPlatformReceivers.get(slug);
    if (!receiver) return { delivered: false, reason: PluginPlatformDeliveryReason.NO_RECEIVER.value };
    // An untenanted installation is its own and only owner: nothing to enter.
    if (!tenantId) return { delivered: true, result: await receiver(payload) };
    if (!(await PluginTenantAccess.isEnabledFor(slug, tenantId))) return { delivered: false, reason: PluginPlatformDeliveryReason.DISABLED.value };
    const result = await RequestContextUtils.storage.run({ tenantId }, () => this.db.withTenant(tenantId, async () => {
      await SiteLocaleAccess.warm(tenantId);
      const store = RequestContextUtils.storage.getStore();
      if (store) store.siteLocale = SiteLocaleAccess.get(tenantId) || undefined;
      return receiver(payload);
    }));
    return { delivered: true, result };
  }
}
