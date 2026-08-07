import { FieldProvenance } from '@/lib/collection/field-provenance';
import type { IFieldFallbackRule } from '@/lib/collection/interfaces/field-fallback-rule.interface';

/**
 * These cases are the real product-6 configuration that shipped a delivery promise nobody set:
 * `madeToOrder = 1`, both lead-time boxes empty, no stored lead-time setting — so the storefront
 * advertised the schema default of 10–15 days with nothing in the admin naming its source.
 */
describe('FieldProvenance', () => {
  const HREF = '/admin/plugins/ecommerce/settings';

  /** The plugin's real settings schema shape: the single source of each setting's label and tab. */
  const SCHEMA = {
    tabs: [{ id: 'delivery', label: 'Delivery' }],
    fields: [
      { name: 'leadTimeDefaultMinDays', label: 'Made-to-order lead time — default min (working days)', tab: 'delivery' },
      { name: 'standardDispatchMinDays', label: 'In-stock dispatch — min (working days)', tab: 'delivery' },
    ],
  };

  const leadTimeMinRules: IFieldFallbackRule[] = [
    {
      when: { field: 'madeToOrder', equals: true },
      settingKey: 'leadTimeDefaultMinDays',
      emptyMeans: 'No preparation window is shown.',
    },
    {
      when: { field: 'madeToOrder', equals: false },
      settingKey: 'standardDispatchMinDays',
      emptyMeans: 'No delivery window is shown for this product.',
    },
  ];

  const settings = { leadTimeDefaultMinDays: 10, standardDispatchMinDays: 1 };

  it('reports the record’s own value when the field is filled in', () => {
    const p = FieldProvenance.resolve(leadTimeMinRules, 7, { madeToOrder: true }, settings, HREF, SCHEMA);
    expect(p?.kind).toBe('own');
  });

  it('names the setting a made-to-order product actually inherits from', () => {
    const p = FieldProvenance.resolve(leadTimeMinRules, '', { madeToOrder: true }, settings, HREF, SCHEMA);
    expect(p?.kind).toBe('inherited');
    expect(p?.effectiveValue).toBe('10');
    expect(p?.settingLabel).toContain('Made-to-order lead time');
    expect(p?.settingsHref).toBe(HREF);
  });

  it('switches to the dispatch setting when the product is NOT made to order', () => {
    const p = FieldProvenance.resolve(leadTimeMinRules, '', { madeToOrder: false }, settings, HREF, SCHEMA);
    expect(p?.kind).toBe('inherited');
    expect(p?.effectiveValue).toBe('1');
    expect(p?.settingLabel).toContain('In-stock dispatch');
  });

  it('treats SQLite 1/0 booleans as booleans, not strings', () => {
    // `made_to_order` comes back as 1 / "1.0" / 0 — a raw === against `true` made every rule miss.
    for (const truthy of [1, '1', '1.0', true]) {
      const p = FieldProvenance.resolve(leadTimeMinRules, '', { madeToOrder: truthy }, settings, HREF, SCHEMA);
      expect(p?.settingLabel).toContain('Made-to-order lead time');
    }
    for (const falsy of [0, '0', '0.0', false]) {
      const p = FieldProvenance.resolve(leadTimeMinRules, '', { madeToOrder: falsy }, settings, HREF, SCHEMA);
      expect(p?.settingLabel).toContain('In-stock dispatch');
    }
  });

  it('says nothing is shown when the setting it points at is ALSO blank', () => {
    // Claiming "inherits from X" while X is empty would be a second invented promise.
    const p = FieldProvenance.resolve(leadTimeMinRules, '', { madeToOrder: false }, { standardDispatchMinDays: '' }, HREF, SCHEMA);
    expect(p?.kind).toBe('none');
    expect(p?.emptyMeans).toBe('No delivery window is shown for this product.');
  });

  it('treats a real 0 as a value the operator set, not as absent', () => {
    const p = FieldProvenance.resolve(leadTimeMinRules, 0, { madeToOrder: true }, settings, HREF, SCHEMA);
    expect(p?.kind).toBe('own');
  });

  it('returns null for a field that declares no fallback at all', () => {
    expect(FieldProvenance.resolve(undefined, '', {}, settings, HREF, SCHEMA)).toBeNull();
  });

  it('accepts a single rule as well as a list', () => {
    const single: IFieldFallbackRule = { settingKey: 'leadTimeDefaultMinDays' };
    const p = FieldProvenance.resolve(single, '', {}, settings, HREF, SCHEMA);
    expect(p?.kind).toBe('inherited');
    expect(p?.effectiveValue).toBe('10');
  });
});
