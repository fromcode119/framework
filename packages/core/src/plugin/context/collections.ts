import type { ICollection } from '@core/interfaces/collection.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IField } from '@core/interfaces/field.interface';
import type { ICollectionInput } from '@core/interfaces/collection-input.interface';
import { Logger } from '@core/logging';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { ContextSecurityProxy } from '@core/plugin/context/utils';
import { PluginRegistry } from '@fromcode119/plugins';
import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';
import { PluginEntityRegistrationService } from '@core/plugin/services/plugin-entity-registration-service';

export class CollectionsContextProxy {
  private static readonly entityRegistration = new PluginEntityRegistrationService();

  static createCollectionsProxy(
  plugin: ILoadedPlugin,
  manager: IPluginManagerInterface,
  rootLogger: Logger,
  security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
) {
      const { hasCapability, handleViolation } = security;

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
          const prefixedSlug = registration.physicalSlug;
          const shortSlug = registration.shortSlug;

          const existing = manager.registeredCollections.get(prefixedSlug);
          if (existing) {
            CollectionsContextProxy.entityRegistration.mergeCollectionFields(existing.collection, modifiedCollection);
          } else {
            manager.registeredCollections.set(prefixedSlug, {
              collection: modifiedCollection,
              pluginSlug: plugin.manifest.slug
            });
          }

          PluginRegistry.registerEntity(plugin.manifest.slug, shortSlug, prefixedSlug);

          manager.emit('collection:registered', { 
            collection: manager.registeredCollections.get(prefixedSlug)?.collection, 
            pluginSlug: plugin.manifest.slug 
          });
        },
        extend: (targetPlugin: string, targetCollection: string, extensions: Partial<ICollection>) => {
          const fullSlug = PhysicalTableNameUtils.create(targetPlugin, targetCollection);

          const entry = manager.getCollection(fullSlug);
          if (entry) {
            if (extensions.fields) {
              const existingNames = new Set(entry.collection.fields.map((f: IField) => f.name));
              extensions.fields.forEach((f: IField) => {
                if (!existingNames.has(f.name)) {
                  entry.collection.fields.push(f);
                }
              });
            }
          } else {
            // Re-run the SAME lookup the immediate branch uses. Comparing `shortSlug` here instead
            // was a second, DIFFERENT identity rule, and the two disagreed whenever a collection's
            // shortSlug is not its table name: `ecommerce/products` registers with
            // shortSlug `catalog`, so `extend('ecommerce','products')` matched on the immediate path
            // but never on the deferred one. Extensions were dropped silently — the SEO plugin's own
            // product columns existed and were populated while the admin showed no SEO fields at all.
            manager.hooks.on('collection:registered', (data: any) => {
               const registered = manager.getCollection(fullSlug);
               if (data.pluginSlug === targetPlugin && registered) {
                  data = { ...data, collection: registered.collection };
                  if (extensions.fields) {
                    const existingNames = new Set(data.collection.fields.map((f: IField) => f.name));
                    extensions.fields.forEach((f: any) => {
                      if (!existingNames.has(f.name)) {
                        data.collection.fields.push(f);
                      }
                    });
                  }
               }
            });
          }
        }
      };

  }
}
