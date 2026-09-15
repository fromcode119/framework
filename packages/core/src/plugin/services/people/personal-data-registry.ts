import { Logger } from '@core/logging';
import { RequestContextUtils } from '@core/context/request-context';
import { PersonalDataStrategy } from '@core/plugin/services/people/enums/personal-data-strategy.enum';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import type { IPersonalDataRegisteredSource } from '@core/plugin/services/interfaces/personal-data-registered-source.interface';
import type { IPersonalDataSourceDescriptor } from '@core/plugin/services/interfaces/personal-data-source-descriptor.interface';

/**
 * Who holds personal data on this platform.
 *
 * FRAMEWORK-OWNED, deliberately. This used to live in a plugin, which made the registry —
 * and therefore the ability to erase a plugin's data at all — conditional on an optional install. On
 * a site without that plugin, "delete my account" erased the seven datasets the framework holds itself
 * and silently left every order, invoice, form submission and review in place. Knowing who holds
 * personal data is not a compliance product; it is a property of the platform.
 *
 * Plugins register through `context.people.personalData.registerSource`, and the framework calls
 * their declared methods back through the plugin manager's own API resolver — no namespace hop, so
 * no `plugins:interact` capability and nothing to fail when one plugin is absent.
 */
export class PersonalDataRegistry {
  private static readonly logger = new Logger({ namespace: 'personal-data' });
  private static readonly sources = new Map<string, IPersonalDataRegisteredSource>();

  /** `pluginSlug:key` — the id an operator's strategy choice is stored against. */
  static idOf(pluginSlug: string, key: string): string {
    return `${String(pluginSlug || '').trim()}:${String(key || '').trim()}`;
  }

  /**
   * Declare a dataset. Refused rather than repaired when the descriptor contradicts itself: a
   * strategy set that does not contain its own default would offer an operator a fallback they can
   * never select.
   */
  static register(
    descriptor: IPersonalDataSourceDescriptor,
    invoke: IPersonalDataRegisteredSource['invoke'],
  ): boolean {
    const pluginSlug = String(descriptor?.pluginSlug || '').trim();
    const key = String(descriptor?.key || '').trim();
    if (!pluginSlug || !key) return false;

    const strategies = PersonalDataRegistry.validStrategies(descriptor?.strategies);
    const defaultStrategy = String(descriptor?.defaultStrategy || '').trim();
    if (strategies.length === 0 || !strategies.includes(defaultStrategy)) return false;

    const id = PersonalDataRegistry.idOf(pluginSlug, key);
    const isNew = !PersonalDataRegistry.sources.has(id);
    PersonalDataRegistry.sources.set(id, {
      ...descriptor,
      pluginSlug,
      key,
      strategies,
      defaultStrategy,
      label: String(descriptor.label || '').trim() || key,
      fields: Array.isArray(descriptor.fields) ? descriptor.fields.map((f) => String(f)) : [],
      invoke,
    });

    // Per landing, never as a summary: plugins register from their own `plugins:ready` handlers, so
    // any total written while that is happening races the registrants and understates coverage.
    //
    // Only on a genuinely NEW id, though. A plugin's `onInit` runs once per tenant, so on a nine-site
    // box every dataset re-registered nine times and logged nine identical lines with an unchanging
    // total — noise that reads like a bug. Re-registration itself is legitimate (it refreshes the
    // descriptor and the invoker), so it stays silent rather than being refused.
    if (isNew) {
      PersonalDataRegistry.logger.info(
        `dataset registered: ${id} (now ${PersonalDataRegistry.sources.size} total)`,
      );
    }
    return true;
  }

  static unregisterByPlugin(pluginSlug: string): void {
    const slug = String(pluginSlug || '').trim();
    for (const [id, source] of PersonalDataRegistry.sources) {
      if (source.pluginSlug === slug) PersonalDataRegistry.sources.delete(id);
    }
  }

  /** Everything registered, regardless of which site runs it. */
  static list(): IPersonalDataRegisteredSource[] {
    return Array.from(PersonalDataRegistry.sources.values());
  }

  /**
   * The sources that apply to the site this request belongs to.
   *
   * The registry is process-wide — one api serves every site — so the raw list names datasets held
   * by plugins a given site does not run. Walked unfiltered, a DSAR on a site that does not run a given plugin reported
   * that plugin's dataset as unreachable, which makes the fulfilment report
   * incomplete and the request impossible to close for a dataset that was never that site's to hold.
   *
   * Outside a request (boot, a scheduler tick) there is no site to narrow to, so everything applies.
   */
  static listForCurrentTenant(): IPersonalDataRegisteredSource[] {
    const all = PersonalDataRegistry.list();
    if (!RequestContextUtils.getTenantId()) return all;
    return all.filter((source) => PluginTenantAccess.isEnabledForCurrentTenant(source.pluginSlug));
  }

  static get(id: string): IPersonalDataRegisteredSource | undefined {
    return PersonalDataRegistry.sources.get(String(id || '').trim());
  }

  static clear(): void {
    PersonalDataRegistry.sources.clear();
  }

  /** Drop anything declared that is not a strategy this platform knows how to run. */
  private static validStrategies(declared: unknown): string[] {
    if (!Array.isArray(declared)) return [];
    return declared.map((s) => PersonalDataStrategy.resolveValue(s)).filter((s) => s !== '');
  }
}
