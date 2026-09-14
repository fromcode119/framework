import { describe, expect, it } from 'vitest';
import { EntitySchemaPlanService } from '@core/database/entity-schema-plan-service';
import type { ICollection } from '@core/collections/interfaces/collection.interface';

describe('EntitySchemaPlanService', () => {
  const collection: ICollection = {
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
    } as ICollection);

    expect(first).toBe(second);
  });

  it('tracks declared indexes without auto-creating them', () => {
    const service = new EntitySchemaPlanService();
    const plan = service.buildPlan(collection, false, []);

    expect(plan.unsupportedIndexes).toEqual(['plugin_products_title_idx']);
  });
  /**
   * A field declared `unique` after its table already existed produced no DDL at all — the plan
   * fingerprinted it and nothing acted on it. That silence is what pushed a plugin into issuing the
   * index by hand on a connection that could not own the table.
   */
  describe('declaredUniques', () => {
    const withUnique: ICollection = {
      slug: 'plugin_affiliates',
      fields: [
        { name: 'id', type: 'number' },
        { name: 'user', type: 'relationship', unique: true },
        { name: 'nickname', type: 'text' },
      ],
    } as ICollection;

    it('reports a declared unique whose column already exists', () => {
      const plan = new EntitySchemaPlanService().buildPlan(withUnique, true, ['id', 'user', 'nickname']);
      expect(plan.declaredUniques).toEqual(['user']);
    });

    it('ignores one whose column is still missing — ADD COLUMN emits the unique itself', () => {
      const plan = new EntitySchemaPlanService().buildPlan(withUnique, true, ['id', 'nickname']);
      expect(plan.declaredUniques).toEqual([]);
      expect(plan.missingColumns.map((column) => column.columnName)).toEqual(['user']);
    });

    it('reports none for a table being created — CREATE TABLE emits them inline', () => {
      const plan = new EntitySchemaPlanService().buildPlan(withUnique, false, []);
      expect(plan.declaredUniques).toEqual([]);
    });

    it('reports none when no field declares one', () => {
      const plan = new EntitySchemaPlanService().buildPlan(collection, true, ['id', 'title', 'stock_count']);
      expect(plan.declaredUniques).toEqual([]);
    });
  });

});
