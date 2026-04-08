import { Collection, LoadedPlugin , Field } from '../../types';
import { Logger } from '../../logging';
import type { PluginManagerInterface } from './utils.interfaces';
import { ContextSecurityProxy } from './utils';
import { PluginRegistry } from '@fromcode119/plugins';
import { NamingStrategy } from '@fromcode119/database/naming-strategy';
import { PhysicalTableNameUtils } from '@fromcode119/database/physical-table-name-utils';


export class CollectionsContextProxy {
  static createCollectionsProxy(
  plugin: LoadedPlugin,
  manager: PluginManagerInterface,
  rootLogger: Logger,
  security: ReturnType<typeof ContextSecurityProxy.createSecurityHelpers>
) {
      const { hasCapability, handleViolation } = security;

      return {
        register: (collection: Collection) => {
          if (!hasCapability('database') && !hasCapability('content')) {
            handleViolation('content');
          }

          const normalizedPluginSlug = NamingStrategy.toSnakeIdentifier(plugin.manifest.slug);
          const tablePrefix = PhysicalTableNameUtils.createPluginPrefix(normalizedPluginSlug);
          const inputSlug = collection.slug;

          // Clean slug to avoid "ecommerce_ecommerce-categories" kind of redundancy
          const cleanInputSlug = inputSlug.startsWith(`${plugin.manifest.slug}-`)
            ? inputSlug.slice(plugin.manifest.slug.length + 1)
            : inputSlug;

          const tableSuffixSource = inputSlug.startsWith(tablePrefix)
            ? inputSlug.replace(tablePrefix, '')
            : cleanInputSlug;
          const normalizedTableSuffix = NamingStrategy.toSnakeIdentifier(tableSuffixSource);
          const prefixedSlug = PhysicalTableNameUtils.create(plugin.manifest.slug, normalizedTableSuffix);

          if ((inputSlug.startsWith(plugin.manifest.slug) && inputSlug !== plugin.manifest.slug) || PhysicalTableNameUtils.hasPlatformPrefix(inputSlug)) {
            rootLogger.warn(
              `Collection slug "${inputSlug}" in plugin "${plugin.manifest.slug}" was automatically cleaned to be used as table name. ` +
              `Final table: ${prefixedSlug}`
            );
          }

          // Use cleanInputSlug (plugin-prefix stripped) so that e.g. "ecommerce-orders"
          // gets shortSlug "orders", enabling URL-to-collection resolution at /ecommerce/orders.
          const shortSlug = collection.shortSlug || (inputSlug.startsWith(tablePrefix) ? inputSlug.replace(tablePrefix, '') : cleanInputSlug);

          const modifiedCollection: Collection = {
            ...collection,
            slug: prefixedSlug,
            shortSlug,
            unprefixedSlug: inputSlug,
            pluginSlug: plugin.manifest.slug,
            displayName: collection.displayName || shortSlug.charAt(0).toUpperCase() + shortSlug.slice(1)
          };

          if (modifiedCollection.workflow) {
            if (!modifiedCollection.fields.find(f => f.name === 'status')) {
                 modifiedCollection.fields.push({
                   name: 'status',
                   type: 'select',
                   label: 'Status',
                   defaultValue: 'draft',
                   options: [
                     { label: 'Draft', value: 'draft' },
                     { label: 'In Review', value: 'review' },
                     { label: 'Published', value: 'published' }
                   ],
                   admin: { position: 'sidebar', section: 'Review Process' }
                 } as any);
            }

            if (!modifiedCollection.fields.find(f => f.name === 'publishedAt')) {
              modifiedCollection.fields.push({
                name: 'publishedAt',
                type: 'datetime',
                label: 'Published Date',
                admin: { position: 'sidebar', section: 'Review Process' }
              } as any);
            }
          }

          if (modifiedCollection.fields.find((f: Field) => f.name === 'slug')) {
            if (!modifiedCollection.fields.find((f: Field) => f.name === 'customPermalink')) {
              modifiedCollection.fields.push({
                name: 'customPermalink',
                type: 'text',
                unique: true,
                admin: { hidden: true }
              } as any);
            }
            if (!modifiedCollection.fields.find((f: Field) => f.name === 'disablePermalink')) {
              modifiedCollection.fields.push({
                name: 'disablePermalink',
                type: 'checkbox',
                defaultValue: false,
                admin: { hidden: true }
              } as any);
            }
          }

          const existing = manager.registeredCollections.get(prefixedSlug);
          if (existing) {
            const fieldNames = new Set(existing.collection.fields.map((f: Field) => f.name));
            for (const field of modifiedCollection.fields) {
              if (!fieldNames.has(field.name)) {
                existing.collection.fields.push(field);
              }
            }
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
        extend: (targetPlugin: string, targetCollection: string, extensions: Partial<Collection>) => {
          const fullSlug = PhysicalTableNameUtils.create(targetPlugin, NamingStrategy.toSnakeIdentifier(targetCollection));

          const entry = manager.getCollection(fullSlug);
          if (entry) {
            if (extensions.fields) {
              const existingNames = new Set(entry.collection.fields.map((f: Field) => f.name));
              extensions.fields.forEach((f: Field) => {
                if (!existingNames.has(f.name)) {
                  entry.collection.fields.push(f);
                }
              });
            }
          } else {
            manager.hooks.on('collection:registered', (data: any) => {
               if (data.pluginSlug === targetPlugin && data.collection.shortSlug === targetCollection) {
                  if (extensions.fields) {
                    const existingNames = new Set(data.collection.fields.map((f: Field) => f.name));
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
