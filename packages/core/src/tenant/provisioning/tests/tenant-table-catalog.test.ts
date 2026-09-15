import { describe, expect, it } from 'vitest';
import type { IDatabaseManager } from '@fromcode119/database';
import { PluginRegistry } from '@fromcode119/plugins';
import type { ICollection } from '@core/collections/interfaces/collection.interface';
import { TenantColumnReference } from '@core/tenant/provisioning/tenant-column-reference';
import { TenantTableCatalog } from '@core/tenant/provisioning/tenant-table-catalog';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

function table(name: string, refs: Array<[string, string]> = [], types: Record<string, string> = { id: 'integer', tenant_id: 'text' }): TenantTableDescriptor {
  return new TenantTableDescriptor(name, types, true, `${name}_id_seq`, refs.map(([column, target]) => new TenantColumnReference(name, column, target, 'fk')));
}

/** A minimal `IDatabaseManager` that answers the four introspection queries `describe()` issues. */
function fakeDb(columnsByTable: Record<string, Record<string, string>>): IDatabaseManager {
  return {
    queryRaw: async (sql: string, params?: unknown[]) => {
      if (sql.includes('pg_constraint')) return [];
      if (sql.includes('is_nullable')) return [];
      if (sql.includes('pg_get_serial_sequence')) return [];
      if (sql.includes('ordinal_position')) {
        const tables = (params?.[0] as string[]) ?? [];
        const rows: Array<{ table_name: string; column_name: string; data_type: string }> = [];
        for (const t of tables) {
          for (const [column, type] of Object.entries(columnsByTable[t] ?? {})) {
            rows.push({ table_name: t, column_name: column, data_type: type });
          }
        }
        return rows;
      }
      return [];
    },
  } as unknown as IDatabaseManager;
}

/** A fictional plugin collection, shaped the way `PluginEntityRegistrationService` leaves one. */
function fakeCollection(overrides: Partial<ICollection>): ICollection {
  return { slug: '', fields: [], ...overrides } as ICollection;
}

describe('TenantTableCatalog.describe — schema-declared references', () => {
  it('follows a hasMany relationship, stored as a bare array of ids', async () => {
    const collection = fakeCollection({
      slug: 'fcp_widgets_items',
      fields: [{ name: 'siblings', type: 'relationship', relationTo: 'fcp_widgets_items', hasMany: true }],
    });
    const db = fakeDb({ fcp_widgets_items: { id: 'integer', tenant_id: 'text', siblings: 'jsonb' } });
    const catalog = new TenantTableCatalog(db, [{ collection, pluginSlug: 'widgets' }]);
    const [descriptor] = await catalog.describe(['fcp_widgets_items']);
    expect(descriptor.references).toHaveLength(1);
    const [ref] = descriptor.references;
    expect(ref.column).toBe('siblings');
    expect(ref.path).toEqual([]);
    expect(ref.hasMany).toBe(true);
    expect(ref.targetTable).toBe('fcp_widgets_items');
    expect(ref.source).toBe('schema');
  });

  it('descends into an array field to find a relationship sub-field, carrying the path and required flag', async () => {
    const collection = fakeCollection({
      slug: 'fcp_widgets_items',
      fields: [
        {
          name: 'rules',
          type: 'array',
          fields: [{ name: 'item', type: 'relationship', relationTo: 'fcp_widgets_items', required: true }],
        },
      ],
    });
    const db = fakeDb({ fcp_widgets_items: { id: 'integer', tenant_id: 'text', rules: 'jsonb' } });
    const catalog = new TenantTableCatalog(db, [{ collection, pluginSlug: 'widgets' }]);
    const [descriptor] = await catalog.describe(['fcp_widgets_items']);
    expect(descriptor.references).toHaveLength(1);
    const [ref] = descriptor.references;
    expect(ref.column).toBe('rules');
    expect(ref.path).toEqual(['item']);
    expect(ref.required).toBe(true);
    expect(ref.describe()).toBe('rules[].item');
  });

  it('resolves a relationTo written as "<plugin>-<entity>", the plugin\'s own prefixed slug', async () => {
    PluginRegistry.registerEntity('widgets', 'items', 'fcp_widgets_items');
    const collection = fakeCollection({
      slug: 'fcp_widgets_items',
      fields: [{ name: 'sibling', type: 'relationship', relationTo: 'widgets-items' }],
    });
    const db = fakeDb({ fcp_widgets_items: { id: 'integer', tenant_id: 'text', sibling: 'integer' } });
    const catalog = new TenantTableCatalog(db, [{ collection, pluginSlug: 'widgets' }]);
    const [descriptor] = await catalog.describe(['fcp_widgets_items']);
    expect(descriptor.references.map((r) => r.targetTable)).toEqual(['fcp_widgets_items']);
  });

  it('resolves a bare sibling slug of the same plugin', async () => {
    PluginRegistry.registerEntity('widgets', 'categories', 'fcp_widgets_categories');
    const collection = fakeCollection({
      slug: 'fcp_widgets_items',
      fields: [{ name: 'category', type: 'relationship', relationTo: 'categories' }],
    });
    const db = fakeDb({
      fcp_widgets_items: { id: 'integer', tenant_id: 'text', category: 'integer' },
      fcp_widgets_categories: { id: 'integer', tenant_id: 'text' },
    });
    const catalog = new TenantTableCatalog(db, [{ collection, pluginSlug: 'widgets' }]);
    const descriptors = await catalog.describe(['fcp_widgets_items', 'fcp_widgets_categories']);
    const descriptor = descriptors.find((d) => d.name === 'fcp_widgets_items') as TenantTableDescriptor;
    expect(descriptor.references.map((r) => r.targetTable)).toEqual(['fcp_widgets_categories']);
  });

  it('exposes whether it was built with any collections at all', () => {
    expect(new TenantTableCatalog(fakeDb({})).hasSchemaReferences).toBe(false);
    expect(new TenantTableCatalog(fakeDb({}), [{ collection: fakeCollection({ slug: 'x' }), pluginSlug: 'p' }]).hasSchemaReferences).toBe(true);
  });
});

describe('TenantTableCatalog.inDependencyOrder', () => {
  it('puts a table after every table it points at', () => {
    const ordered = TenantTableCatalog.inDependencyOrder([
      table('people_addresses', [['person_id', 'people']]),
      table('person_relationships', [['from_person_id', 'people'], ['to_person_id', 'people']]),
      table('people', [['user_id', 'users']]),
      table('media', [['folder_id', 'media_folders']]),
      table('media_folders', [['parent_id', 'media_folders']]),
    ]).map((d) => d.name);
    expect(ordered.indexOf('people')).toBeLessThan(ordered.indexOf('people_addresses'));
    expect(ordered.indexOf('people')).toBeLessThan(ordered.indexOf('person_relationships'));
    expect(ordered.indexOf('media_folders')).toBeLessThan(ordered.indexOf('media'));
    expect(ordered).toHaveLength(5);
  });

  it('does not loop on a self-reference and does not list it as a dependency', () => {
    const folders = table('media_folders', [['parent_id', 'media_folders']]);
    expect(folders.dependsOn).toEqual([]);
    expect(folders.selfReferences.map((r) => r.column)).toEqual(['parent_id']);
    expect(TenantTableCatalog.inDependencyOrder([folders]).map((d) => d.name)).toEqual(['media_folders']);
  });

  it('survives a cycle between two tables instead of hanging', () => {
    const ordered = TenantTableCatalog.inDependencyOrder([table('a', [['b_id', 'b']]), table('b', [['a_id', 'a']])]);
    expect(ordered.map((d) => d.name).sort()).toEqual(['a', 'b']);
  });
});

describe('TenantTableDescriptor', () => {
  it('knows its JSON and boolean columns from the catalog types', () => {
    const d = table('fcp_zeta_pages', [], { id: 'integer', content: 'jsonb', meta: 'json', published: 'boolean', title: 'text', tenant_id: 'text' });
    expect(d.jsonColumns).toEqual(['content', 'meta']);
    expect(d.booleanColumns).toEqual(['published']);
    expect(d.hasTenantColumn).toBe(true);
  });
});
