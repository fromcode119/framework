import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminPluginConsentEndpoints } from '@/lib/constants/admin-plugin-consent-endpoints';
import type { IPluginConsentSummary } from '@/components/plugins/interfaces/plugin-consent-summary.interface';
import { PluginConsentScope } from '@/components/plugins/enums/plugin-consent-scope.enum';

/**
 * Reading what a plugin asks for and approving it. The server refuses an approval whose list differs
 * from what the plugin asks for now, so `approve` sends back exactly the list the dialog showed.
 */
export class PluginConsentRequest {
  static readonly REQUIRED_CODE = 'PLUGIN_CONSENT_REQUIRED';

  static async fetch(slug: string, scope: PluginConsentScope = PluginConsentScope.PLATFORM): Promise<IPluginConsentSummary> {
    const path = scope === PluginConsentScope.SITE ? AdminPluginConsentEndpoints.siteConsent(slug) : AdminPluginConsentEndpoints.consent(slug);
    return await AdminApi.get(path, { noDedupe: true }) as IPluginConsentSummary;
  }

  /** Approves and turns the plugin on. */
  static async approve(summary: IPluginConsentSummary, scope: PluginConsentScope = PluginConsentScope.PLATFORM): Promise<void> {
    if (scope === PluginConsentScope.SITE) {
      await AdminApi.post(AdminPluginConsentEndpoints.siteApprove(summary.slug), { approve: summary.consent });
      return;
    }
    await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.TOGGLE(summary.slug), { enabled: true, approve: summary.consent });
  }

  /** The summary a refused enable carried — the plugin asks for something nobody approved — or null. */
  static fromError(error: unknown): IPluginConsentSummary | null {
    const data = (error as { data?: { code?: unknown; summary?: IPluginConsentSummary } } | null)?.data;
    return data?.code === PluginConsentRequest.REQUIRED_CODE && data.summary ? data.summary : null;
  }
}
