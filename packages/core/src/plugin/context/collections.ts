import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IField } from '@core/interfaces/field.interface';
import type { ICollectionInput } from '@core/collections/interfaces/collection-input.interface';
import type { ICollectionPublicContentSource } from '@core/collections/interfaces/collection-public-content-source.interface';
import { Logger } from '@core/logging';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { ContextSecurityProxy } from '@core/plugin/context/utils';
import { PluginRegistry } from '@fromcode119/plugins';
import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import { PluginEntityRegistrationService } from '@core/plugin/services/plugin-entity-registration-service';
import { PluginEntityProviderRegistry } from '@core/services/entities/plugin-entity-provider-registry';
import { CollectionWriteBridge } from '@core/plugin/collection-write-bridge';
import { OwnCollectionRefresh } from '@core/plugin/context/own-collection-refresh';
import { CollectionLabelUtils } from '@core/collections/collection-label-utils';

export class CollectionsContextProxy {
  private static readonly entityRegistration = new PluginEntityRegistrationService();
  /** Who provides `order`, `product`, … so a consumer never has to name another plugin's collection. */
  static readonly entityProviders = new PluginEntityProviderRegistry();

  static createCollectionsProxy(
  plugin: ILoadedPlugin,
  manager: IPluginManagerInterface,
  rootLogger: Logger,
  security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
) {
      const { hasCapability, handleViolation } = security;

      // OWN collections only — same isolation as context.db. Cross-plugin writes go through the
      // namespace API of the plugin that owns the data, never through this path.
      const ownCollection = (collectionSlug: string, verb: string): string => {
        if (!hasCapability('database') && !hasCapability('content')) {
          handleViolation('content');
        }
        const fullSlug = PhysicalTableNameUtils.create(plugin.manifest.slug, collectionSlug);
        const entry = manager.getCollection(fullSlug);
        if (!entry || entry.pluginSlug !== plugin.manifest.slug) {
          throw new Error(`Plugin "${plugin.manifest.slug}" may ${verb} only its own collections; "${collectionSlug}" is not one of them.`);
        }
        return fullSlug;
      };

      return {
        register: (collection: ICollectionInput) => {
          if (!hasCapability('database') && !hasCapability('content')) {
            handleViolation('content');
          }

          const registration = CollectionsContextProxy.entityRegistration.normalizeForPlugin(collection, plugin.manifest.slug);
          if (registration.cleanedSlug) {
            rootLogger.info(
              `Collection slug "${collection.slug}" in plugin "${plugin.manifest.slug}" was automatically cleaned to be used as table name. ` +
              `Final table: ${registration.physicalSlug}`
            );
          }
          const modifiedCollection = CollectionsContextProxy.entityRegistration.applyFrameworkFields(registration.collection);

          // Both directions, because registration order is not guaranteed: this collection may PROVIDE
          // an entity others are already waiting on, and may CONSUME one whose provider has not booted
          // yet. Providing drains the waiters; consuming parks anything still unknown.
          CollectionsContextProxy.entityProviders.registerProvider(modifiedCollection, plugin.manifest.slug);
          const unresolved = CollectionsContextProxy.entityProviders.resolveConsumer(modifiedCollection, plugin.manifest.slug);
          if (unresolved.length) {
            rootLogger.info(
              `Collection "${modifiedCollection.slug}" in plugin "${plugin.manifest.slug}" waits for entity provider(s): ${unresolved.join(', ')}`
            );
          }
          const prefixedSlug = registration.physicalSlug;
          const shortSlug = registration.shortSlug;

          const announce = () => manager.emit('collection:registered', {
            collection: manager.registeredCollections.get(prefixedSlug)?.collection,
            pluginSlug: plugin.manifest.slug
          });
          const existing = manager.registeredCollections.get(prefixedSlug);
          PluginRegistry.registerEntity(plugin.manifest.slug, shortSlug, prefixedSlug);
          if (existing?.pluginSlug === plugin.manifest.slug) {
            // A hot update: new fields join once their columns exist (OwnCollectionRefresh).
            return OwnCollectionRefresh.apply(manager.schemaManager, CollectionsContextProxy.entityRegistration, existing.collection, modifiedCollection, rootLogger, announce);
          }
          if (existing) {
            CollectionsContextProxy.entityRegistration.mergeCollectionFields(existing.collection, modifiedCollection);
          } else {
            manager.registeredCollections.set(prefixedSlug, {
              collection: modifiedCollection,
              pluginSlug: plugin.manifest.slug
            });
          }
          announce();
        },
        create: async (collectionSlug: string, data: Record<string, unknown>, options?: { user?: unknown }) => {
          const fullSlug = ownCollection(collectionSlug, 'create');
          return CollectionWriteBridge.create(fullSlug, data, options?.user ?? null);
        },
        update: async (collectionSlug: string, id: number | string, data: Record<string, unknown>, options?: { user?: unknown }) => {
          const fullSlug = ownCollection(collectionSlug, 'update');
          return CollectionWriteBridge.update(fullSlug, id, data, options?.user ?? null);
        },
        publicContent: async (): Promise<ICollectionPublicContentSource[]> => {
          const sources: ICollectionPublicContentSource[] = [];
          for (const entry of manager.registeredCollections.values()) {
            const declared = entry.collection?.publicContent;
            if (!declared) continue;
            const owner = manager.plugins.get(entry.pluginSlug);
            const slug = entry.collection.unprefixedSlug || entry.collection.slug;
            sources.push({
              plugin: entry.pluginSlug,
              namespace: String(owner?.manifest.namespace || '').trim(),
              slug,
              label: CollectionLabelUtils.labelFor(entry.collection, slug),
              entity: entry.collection.entity || '',
              list: declared.list || '',
              at: declared.at || '',
            });
          }
          return sources;
        },
        extendPublicContent: (extensions: Pick<ICollection, 'fields'>) => {
          for (const entry of manager.registeredCollections.values()) {
            if (entry.collection?.publicContent) CollectionsContextProxy.mergeExtension(entry.collection, extensions, plugin.manifest.slug);
          }
          // A collection registered later — or re-registered by a hot update — is merged as it announces itself.
          manager.hooks.on('collection:registered', (data: any) => {
            const registered = data?.collection;
            if (registered?.publicContent) CollectionsContextProxy.mergeExtension(registered, extensions, plugin.manifest.slug);
          });
        },
        extend: (targetPlugin: string, targetCollection: string, extensions: Partial<ICollection>) => {
          const fullSlug = PhysicalTableNameUtils.create(targetPlugin, targetCollection);

          const entry = manager.getCollection(fullSlug);
          if (entry) {
            CollectionsContextProxy.mergeExtension(entry.collection, extensions, plugin.manifest.slug);
          } else {
            // Re-run the SAME lookup the immediate branch uses. Comparing `shortSlug` here instead
            // was a second, DIFFERENT identity rule, and the two disagreed whenever a collection's
            // shortSlug is not its table name: `<plugin>/widgets` may register with
            // a different shortSlug, so `extend('<plugin>','widgets')` matched on the immediate path
            // but never on the deferred one. Extensions were dropped silently — a metadata plugin's own
            // product columns existed and were populated while the admin showed none of its fields.
            manager.hooks.on('collection:registered', (data: any) => {
               const registered = manager.getCollection(fullSlug);
               if (data.pluginSlug === targetPlugin && registered) {
                  data = { ...data, collection: registered.collection };
                  CollectionsContextProxy.mergeExtension(data.collection, extensions, plugin.manifest.slug);
               }
            });
          }
        }
      };

  }

  /**
   * Adds an extender's fields to another plugin's collection. A field the target declares itself is
   * never touched. A field THIS extender added earlier is replaced: a hot plugin update re-runs
   * `extend()` against collections still holding the previous release's field, and keeping the old
   * one left every extended collection on the old definition until the api restarted.
   */
  static mergeExtension(collection: ICollection, extensions: Partial<ICollection>, extenderSlug: string): void {
    for (const field of extensions.fields || []) {
      const next = { ...field, extendedBy: extenderSlug } as IField;
      const index = collection.fields.findIndex((existing: IField) => existing.name === field.name);
      if (index === -1) collection.fields.push(next);
      else if (collection.fields[index].extendedBy === extenderSlug) collection.fields[index] = next;
    }
  }
}
