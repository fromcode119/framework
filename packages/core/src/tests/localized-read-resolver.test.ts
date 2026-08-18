import { describe, expect, it } from 'vitest';
import { LocalizedReadResolver } from '@core/plugin/context/localized-read-resolver';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * Localized values are stored as a per-locale map. The REST controller has always resolved them for
 * `/collections/...`, but a plugin's OWN endpoints read through `context.db`, so they returned the raw
 * map — a storefront reading products through the alpha plugin API rendered
 * `{"bg":"…","en":"…"}` as the product name the moment a second locale was filled in.
 *
 * These pin the resolver that closes the gap, including the property that makes the rollout safe: a
 * pre-existing FLAT string must come back byte-identical, so untouched records read exactly as before.
 */
describe('LocalizedReadResolver.resolveResult', () => {
  /**
   * Minimal stand-in for the plugin manager: only `getCollection` is consulted.
   *
   * It returns the registry's `{ collection, pluginSlug }` ENTRY, not the collection — the shape
   * `PluginRuntimeStateService.getCollection` actually returns. An earlier version of this mock handed
   * back the collection directly, which is what the resolver wrongly expected, so the whole suite
   * passed green while the storefront still received raw locale maps in the running system.
   */
  const managerFor = (fields: Array<Record<string, unknown>>) => ({
    getCollection: () => ({ collection: { slug: 'alpha-products', fields }, pluginSlug: 'alpha' }),
  }) as any;

  const PRODUCT_FIELDS = [
    { name: 'name', type: 'text', localized: true },
    { name: 'slug', type: 'text' },
    { name: 'description', type: 'textarea', localized: true },
  ];

  const runInLocale = <T,>(locale: string | undefined, run: () => T): T =>
    RequestContextUtils.storage.run({ locale } as any, run);

  it('collapses a locale map to the request locale', () => {
    const row = { id: 1, name: { bg: 'Примерен запис', en: 'Sample record' }, slug: 'sample-record' };
    const resolved = runInLocale('en', () =>
      LocalizedReadResolver.resolveResult(row, '@alpha/products', managerFor(PRODUCT_FIELDS)),
    ) as any;

    expect(resolved.name).toBe('Sample record');
    expect(resolved.slug).toBe('sample-record');
  });

  it('resolves the other locale from the same row', () => {
    const row = { id: 1, name: { bg: 'Примерен запис', en: 'Sample record' } };
    const resolved = runInLocale('bg', () =>
      LocalizedReadResolver.resolveResult(row, '@alpha/products', managerFor(PRODUCT_FIELDS)),
    ) as any;

    expect(resolved.name).toBe('Примерен запис');
  });

  it('leaves a legacy flat string exactly as stored — the property that makes rollout safe', () => {
    const row = { id: 1, name: 'Примерен запис', description: 'Кратко описание' };
    const resolved = runInLocale('en', () =>
      LocalizedReadResolver.resolveResult(row, '@alpha/products', managerFor(PRODUCT_FIELDS)),
    ) as any;

    expect(resolved).toEqual(row);
  });

  it('accepts a locale map stored as JSON text, which is how it lands in a text column', () => {
    const row = { id: 1, name: '{"bg":"Примерен запис","en":"Sample record"}' };
    const resolved = runInLocale('en', () =>
      LocalizedReadResolver.resolveResult(row, '@alpha/products', managerFor(PRODUCT_FIELDS)),
    ) as any;

    expect(resolved.name).toBe('Sample record');
  });

  it('falls through to a populated locale when the requested one is blank', () => {
    const row = { id: 1, name: { bg: 'Примерен запис', en: '   ' } };
    const resolved = runInLocale('en', () =>
      LocalizedReadResolver.resolveResult(row, '@alpha/products', managerFor(PRODUCT_FIELDS)),
    ) as any;

    expect(resolved.name).toBe('Примерен запис');
  });

  it('resolves every row of a list read', () => {
    const rows = [
      { id: 1, name: { bg: 'Едно', en: 'One' } },
      { id: 2, name: { bg: 'Две', en: 'Two' } },
      { id: 3, name: 'Три' },
    ];
    const resolved = runInLocale('en', () =>
      LocalizedReadResolver.resolveResult(rows, '@alpha/products', managerFor(PRODUCT_FIELDS)),
    ) as any[];

    expect(resolved.map((row) => row.name)).toEqual(['One', 'Two', 'Три']);
  });

  it('resolves a non-string localized value (a json content field) to the locale\'s own structure', () => {
    const fields = [{ name: 'contentBlocks', type: 'json', localized: true }];
    const row = { id: 1, contentBlocks: { bg: [{ type: 'hero' }], en: [{ type: 'banner' }] } };
    const resolved = runInLocale('en', () =>
      LocalizedReadResolver.resolveResult(row, '@alpha/products', managerFor(fields)),
    ) as any;

    expect(resolved.contentBlocks).toEqual([{ type: 'banner' }]);
  });

  it('leaves rows untouched when the collection declares no localized field', () => {
    const row = { id: 1, name: { bg: 'Примерен запис', en: 'Sample record' } };
    const fields = [{ name: 'name', type: 'text' }];
    const resolved = runInLocale('en', () =>
      LocalizedReadResolver.resolveResult(row, '@alpha/products', managerFor(fields)),
    ) as any;

    expect(resolved.name).toEqual({ bg: 'Примерен запис', en: 'Sample record' });
  });

  it('leaves rows untouched for a table with no registered collection', () => {
    const manager = { getCollection: () => null } as any;
    const row = { id: 1, name: { bg: 'Примерен запис', en: 'Sample record' } };

    expect(LocalizedReadResolver.resolveResult(row, '@alpha/unknown', manager)).toBe(row);
  });

  it('passes null and undefined straight through', () => {
    const manager = managerFor(PRODUCT_FIELDS);
    expect(LocalizedReadResolver.resolveResult(null, '@alpha/products', manager)).toBeNull();
    expect(LocalizedReadResolver.resolveResult(undefined, '@alpha/products', manager)).toBeUndefined();
  });

  /**
   * The shapes a wiping save leaves behind. A production admin save collapsed a legacy flat
   * `shortDescription` to `{}`; `isLocaleMap` rejects keyless objects, so the raw `{}` leaked through
   * every plugin read and the storefront rendered "[object Object]" as the product blurb.
   */
  describe('wiped locale values', () => {
    it('collapses an emptied locale map to empty string instead of leaking the raw object', () => {
      const row = { id: 8, name: {}, description: 'Кратко описание' };
      const resolved = runInLocale('bg', () =>
        LocalizedReadResolver.resolveResult(row, '@alpha/products', managerFor(PRODUCT_FIELDS)),
      ) as any;

      expect(resolved.name).toBe('');
      expect(resolved.description).toBe('Кратко описание');
    });

    it('collapses the JSON-text form of an emptied map, which is how a text column stores it', () => {
      const row = { id: 8, name: '{}' };
      const resolved = runInLocale('bg', () =>
        LocalizedReadResolver.resolveResult(row, '@alpha/products', managerFor(PRODUCT_FIELDS)),
      ) as any;

      expect(resolved.name).toBe('');
    });

    it('skips an empty-object locale slot and falls through to the locale that has copy', () => {
      const row = { id: 8, name: { bg: {}, en: 'Sample record' } };
      const resolved = runInLocale('bg', () =>
        LocalizedReadResolver.resolveResult(row, '@alpha/products', managerFor(PRODUCT_FIELDS)),
      ) as any;

      expect(resolved.name).toBe('Sample record');
    });

    it('resolves to empty string when every locale slot is an empty object', () => {
      const row = { id: 8, name: { bg: {} } };
      const resolved = runInLocale('bg', () =>
        LocalizedReadResolver.resolveResult(row, '@alpha/products', managerFor(PRODUCT_FIELDS)),
      ) as any;

      expect(resolved.name).toBe('');
    });
  });
});
