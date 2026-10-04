import { describe, expect, it } from 'vitest';
import { LocalizationService } from '@api/services/localization-service';

/**
 * A read of a few fields (ICollectionReadOptions.fields) went out with every declared field added to each
 * row as `undefined` — dozens of empty keys per row, copied again by every step after it.
 */
describe('LocalizationService outgoing data', () => {
  const collection: any = { slug: 'items', fields: [
    { name: 'title', type: 'text', localized: true },
    { name: 'tags', type: 'array' },
    { name: 'card', type: 'json' },
  ] };
  const options = { localeContext: { chain: ['bg'], defaultLocale: 'bg' }, rawLocalized: false };

  it('adds no field the record was not read with, and still resolves the ones it was', () => {
    const svc = new LocalizationService({} as any);
    expect(svc.transformOutgoingData(collection, { id: 1, card: { a: 1 } }, options)).toEqual({ id: 1, card: { a: 1 } });
    expect(Object.keys(svc.transformOutgoingData(collection, { id: 1, card: null }, options))).toEqual(['id', 'card']);
    expect(svc.transformOutgoingData(collection, { id: 2, title: '{"bg":"Кутия"}', tags: '["x"]' }, options))
      .toEqual({ id: 2, title: 'Кутия', tags: ['x'] });
  });
});
