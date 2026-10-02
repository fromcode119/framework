import { RequestContextUtils } from '@core/context/request-context';
import { SiteLocaleAccess } from '@core/i18n/site-locale-access';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { IPluginDefaultPageContractCreatePayload } from '@core/default-page-contract/interfaces/plugin-default-page-contract-create-payload.interface';

/**
 * The title of a default page, in the language of the SITE it is created for.
 *
 * Contracts are declared once at boot, before any site is known, so a `title` computed then is in the
 * platform's language. The contract's `titleKey` is looked up here instead, inside the site, in its
 * default locale (Settings → Localization); `title` is used where that language has no translation.
 */
export class DefaultPageSiteTitle {
  constructor(private readonly manager: IPluginManagerInterface) {}

  async resolve(payload: IPluginDefaultPageContractCreatePayload): Promise<string | undefined> {
    const key = String(payload.titleKey || '').trim();
    if (!key) return payload.title;
    const tenantId = RequestContextUtils.getTenantId();
    if (tenantId) await SiteLocaleAccess.warm(tenantId);
    const locale = SiteLocaleAccess.get(tenantId) || this.manager.i18n.getDefaultLocale();
    return this.manager.i18n.translateOrFallback(`${payload.pluginSlug}.${key}`, payload.title || '', {}, locale) || payload.title;
  }
}
