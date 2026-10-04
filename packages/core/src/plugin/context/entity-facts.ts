import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { CoreServices } from '@core/services/core-services';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';

/**
 * Plugin-facing facade over {@link EntityFactsRegistryService}. Namespace and slug come from the
 * plugin's own manifest, so a plugin only says which entity, which fact, and how to answer.
 */
export class EntityFactsContextProxy {
  static createEntityFactsProxy(plugin: ILoadedPlugin) {
    const namespace = String(plugin?.manifest?.namespace || '').trim();
    const pluginSlug = String(plugin?.manifest?.slug || '').trim();
    return {
      registerProvider(input: { entity: string; fact: string; resolve: (ids: string[]) => Promise<Record<string, unknown>> }) {
        // Read live from the plugin record: a disable, a crash or a per-site switch-off takes effect on the next question.
        const answers = () => PluginState.resolve(plugin?.state) === PluginState.ACTIVE && PluginTenantAccess.isVisibleForCurrentTenant(plugin);
        return CoreServices.getInstance().entityFacts.register({ namespace, pluginSlug, entity: input?.entity, fact: input?.fact, resolve: input?.resolve, answers });
      },
      resolve(entity: string, fact: string, ids: Array<string | number>) {
        return CoreServices.getInstance().entityFacts.resolve(entity, fact, ids);
      },
      // Async in both worlds: an isolated plugin asks across its process boundary.
      async has(entity: string, fact: string) {
        return CoreServices.getInstance().entityFacts.has(entity, fact);
      },
    };
  }
}
