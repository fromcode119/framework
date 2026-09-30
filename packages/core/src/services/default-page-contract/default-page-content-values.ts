import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';
import { SystemSettingsExposureUtils } from '@core/security/system-settings-exposure-utils';
import { SiteBaseUrl } from '@core/tenant/site-base-url';
import { PluginsManagerResolver } from '@core/plugin/plugins-manager-resolver';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import type { IPluginDefaultPageContractCreatePayload } from '@core/default-page-contract/interfaces/plugin-default-page-contract-create-payload.interface';

/**
 * Fills the `{{name}}` placeholders of a default page's content for the SITE it is created in.
 *
 * Default content is written once, when a site gets the page, and is the operator's to edit from then
 * on. Text naming who runs the site (its name, address, the company behind it) cannot be written into
 * the plugin: every site that enables it would publish another site's identity. So the text says
 * `{{siteName}}` and the values are looked up here, inside the site being seeded:
 *
 * - `{{siteName}}`, `{{siteHost}}` — the framework's own: Settings → General → Platform Name, and the
 *   site's frontend host.
 * - anything else — the owning plugin's public-API method named by the contract's `contentValues`.
 *
 * A placeholder with no value becomes empty text; it never falls back to someone else's words.
 */
export class DefaultPageContentValues {
  private static readonly PLACEHOLDER = /\{\{\s*([A-Za-z][\w.]*)\s*\}\}/g;
  /** Non-global twin for the presence check: a `/g` pattern's `test` keeps `lastIndex` between calls. */
  private static readonly HAS_PLACEHOLDER = /\{\{\s*[A-Za-z][\w.]*\s*\}\}/;

  constructor(private readonly manager: IPluginManagerInterface) {}

  async fill(payload: IPluginDefaultPageContractCreatePayload): Promise<any[]> {
    const content = Array.isArray(payload.defaultContent) ? payload.defaultContent : [];
    if (!DefaultPageContentValues.HAS_PLACEHOLDER.test(JSON.stringify(content))) return content;
    const values = { ...(await this.siteValues()), ...(await this.ownerValues(payload)) };
    return DefaultPageContentValues.replace(content, values) as any[];
  }

  /** Every string in `node` with its placeholders replaced; structure and non-text values untouched. */
  static replace(node: unknown, values: Record<string, string>): unknown {
    if (Array.isArray(node)) return node.map((item) => DefaultPageContentValues.replace(item, values));
    if (node !== null && Object.getPrototypeOf(node) === Object.prototype) {
      return Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([key, value]) => [key, DefaultPageContentValues.replace(value, values)]));
    }
    if (String(node) !== node) return node;
    return (node as string).replace(DefaultPageContentValues.PLACEHOLDER, (_match, name: string) => values[name] ?? '');
  }

  private async siteValues(): Promise<Record<string, string>> {
    // `find`, not `findOne`: Platform Name is inherited, so the site's own row must win over the platform's.
    const rows = await this.manager.db.find(SystemConstants.TABLE.META, { where: { key: SystemConstants.META_KEY.PLATFORM_NAME } }).catch(() => []);
    const siteName = String(SystemSettingsExposureUtils.toExposableSettingsMap(rows)[SystemConstants.META_KEY.PLATFORM_NAME] ?? '').trim();
    let siteHost = '';
    try {
      siteHost = new URL(await SiteBaseUrl.forCurrentSite(ApplicationUrlUtils.FRONTEND_APP)).host;
    } catch {
      siteHost = '';
    }
    return { siteName, siteHost };
  }

  private async ownerValues(payload: IPluginDefaultPageContractCreatePayload): Promise<Record<string, string>> {
    const method = String(payload.contentValues || '').trim();
    if (!method) return {};
    const plugin = this.manager.plugins.get(payload.pluginSlug);
    // The owner is usually mid-activation here (its pages are created inside its own activation).
    if (!plugin || !PluginsManagerResolver.isResolvableWhileActivating(plugin, RequestContextUtils.getTenantId() ?? null)) return {};
    const answer = await (plugin.publicAPI as Record<string, (input: unknown) => Promise<unknown>>)?.[method]?.({ contractKey: payload.key }).catch(() => null);
    return Object.fromEntries(Object.entries((answer ?? {}) as Record<string, unknown>).map(([key, value]) => [key, value == null ? '' : String(value)]));
  }
}
