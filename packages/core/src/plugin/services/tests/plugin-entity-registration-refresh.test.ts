import { describe, expect, it } from 'vitest';
import { PluginEntityRegistrationService } from '@core/plugin/services/plugin-entity-registration-service';

/**
 * A new release of an isolated plugin registers its collections again from a fresh process. The
 * collection the api already holds must take the release's declaration — the console showed a
 * release's new list layout only after an api restart, because `admin` was never refreshed.
 */
describe('PluginEntityRegistrationService.refreshOwnCollection', () => {
  const registered = () => ({
    slug: 'products',
    displayName: 'Products',
    admin: { useAsTitle: 'name', defaultColumns: ['name', 'price'] },
    fields: [
      { name: 'name', type: 'text' },
      { name: 'price', type: 'number' },
      { name: 'origin', type: 'text', extendedBy: 'metadata' },
    ],
  } as any);

  it("takes the release's admin declaration and name", () => {
    const existing = registered();
    new PluginEntityRegistrationService().refreshOwnCollection(existing, {
      slug: 'products',
      displayName: 'Catalog',
      admin: { useAsTitle: 'name', defaultColumns: ['name', 'sku'], list: { trailing: 'price', quickEdit: { inline: ['price'] } } },
      fields: [{ name: 'name', type: 'text' }, { name: 'price', type: 'number' }, { name: 'sku', type: 'text' }],
    } as any);
    expect(existing.displayName).toBe('Catalog');
    expect(existing.admin).toEqual({ useAsTitle: 'name', defaultColumns: ['name', 'sku'], list: { trailing: 'price', quickEdit: { inline: ['price'] } } });
  });

  it("keeps another plugin's extension fields while replacing the owner's", () => {
    const existing = registered();
    new PluginEntityRegistrationService().refreshOwnCollection(existing, {
      slug: 'products',
      admin: {},
      fields: [{ name: 'name', type: 'text', localized: true }, { name: 'price', type: 'number' }],
    } as any);
    expect(existing.fields.map((field: any) => field.name)).toEqual(['name', 'price', 'origin']);
    expect((existing.fields[0] as any).localized).toBe(true);
  });
});
