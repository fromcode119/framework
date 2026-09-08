import { describe, expect, it } from 'vitest';
import { TenantColumnReference } from '@core/tenant/provisioning/tenant-column-reference';
import { TenantTableCatalog } from '@core/tenant/provisioning/tenant-table-catalog';
import { TenantTableDescriptor } from '@core/tenant/provisioning/tenant-table-descriptor';

function table(name: string, refs: Array<[string, string]> = [], types: Record<string, string> = { id: 'integer', tenant_id: 'text' }): TenantTableDescriptor {
  return new TenantTableDescriptor(name, types, true, `${name}_id_seq`, refs.map(([column, target]) => new TenantColumnReference(name, column, target, 'fk')));
}

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
