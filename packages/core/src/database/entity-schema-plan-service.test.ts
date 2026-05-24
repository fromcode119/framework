import { describe, expect, it } from 'vitest';
import { EntitySchemaPlanService } from './entity-schema-plan-service';
import type { Collection } from '../types';

describe('EntitySchemaPlanService', () => {
  const collection: Collection = {
    slug: 'plugin_products',
    fields: [
      { name: 'id', type: 'number' },
      { name: 'title', type: 'text', required: true },
      { name: 'stockCount', type: 'number' },
    ],
    indexes: [
      { fields: ['title'], unique: true },
    ],
  };

  it('plans missing columns from collection metadata', () => {
    const service = new EntitySchemaPlanService();
    const plan = service.buildPlan(collection, true, ['id', 'title']);

    expect(plan.exists).toBe(true);
    expect(plan.missingColumns).toEqual([
      {
        field: { name: 'stockCount', type: 'number' },
        columnName: 'stock_count',
      },
    ]);
  });

  it('creates stable fingerprints independent of object key order', () => {
    const service = new EntitySchemaPlanService();
    const first = service.createFingerprint(collection);
    const second = service.createFingerprint({
      indexes: collection.indexes,
      fields: collection.fields,
      slug: collection.slug,
    } as Collection);

    expect(first).toBe(second);
  });

  it('tracks declared indexes without auto-creating them', () => {
    const service = new EntitySchemaPlanService();
    const plan = service.buildPlan(collection, false, []);

    expect(plan.unsupportedIndexes).toEqual(['plugin_products_title_idx']);
  });
});
