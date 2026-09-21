import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { CoreServices } from '@core/services/core-services';
import type { IEntityRecordProviderRegistration } from '@core/services/entity-records/interfaces/entity-record-provider-registration.interface';

/**
 * Plugin-facing facade over the framework's entity-records registry.
 *
 * A plugin registers a provider — "given a person, here are the records I own" (invoices,
 * declarations, agreements, orders, shipments, …). The namespace and slug are filled from the plugin's
 * own manifest, so the plugin only supplies the provider key, a label, and the resolver. The framework
 * aggregates every plugin's records into one grouped timeline for the Person 360 / partner-CRM view.
 *
 * Declaring `matchKeys` registers the OTHER question instead: "given any record that can identify
 * itself with one of these correlation keys, here are the records I hold about it". That is how a
 * transaction, an invoice, a shipment and a scheduled job find their way onto one order without any
 * plugin naming another — they all understand `orderNumber`, and none of them knows what an order is.
 */
export class EntityRecordsContextProxy {
  static createEntityRecordsProxy(plugin: ILoadedPlugin) {
    const namespace = String(plugin?.manifest?.namespace || '').trim();
    const pluginSlug = String(plugin?.manifest?.slug || '').trim();

    return {
      registerProvider(
        input: Pick<IEntityRecordProviderRegistration, 'key' | 'label' | 'resolve'> &
          Partial<Pick<IEntityRecordProviderRegistration, 'matchKeys'>>,
      ) {
        return CoreServices.getInstance().entityRecords.register({
          namespace,
          pluginSlug,
          key: String(input?.key || '').trim(),
          label: String(input?.label || '').trim(),
          matchKeys: input?.matchKeys,
          resolve: input?.resolve,
        });
      },

      unregister(key: string) {
        const canonicalKey = `${namespace}:${pluginSlug}:${String(key || '').trim()}`;
        CoreServices.getInstance().entityRecords.unregister(canonicalKey);
      },
    };
  }
}
