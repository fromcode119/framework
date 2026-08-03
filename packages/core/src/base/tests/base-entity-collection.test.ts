import { describe, expect, it } from 'vitest';
import { EntityColumn } from '@core/entity-column';
import { BaseEntityCollection } from '@core/base/base-entity-collection';
import { FieldType } from '@core/enums/field-type.enum';

class TestProducts extends BaseEntityCollection<Record<string, unknown>> {
  readonly slug = 'products';

  @EntityColumn.text({ from: ['name', 'title'], required: true })
  name!: string;

  @EntityColumn.number({ transform: 'round2' })
  price!: number;

  @EntityColumn.enum({
    default: 'draft',
    values: {
      published: ['active', 'live'],
      draft: ['inactive'],
    },
  })
  status!: string;
}

describe('BaseEntityCollection', () => {
  it('maps records from one field config', () => {
    const products = new TestProducts();

    expect(products.map({ title: 'Book', price: '12.345', status: 'live' })).toEqual({
      name: 'Book',
      price: 12.35,
      status: 'published',
    });
  });

  it('derives collection fields from the same config', () => {
    const definition = new TestProducts().collectionDefinition();

    expect(definition.slug).toBe('products');
    expect(definition.fields).toMatchObject([
      { name: 'name', type: FieldType.TEXT, required: true, inputAliases: ['name', 'title'] },
      { name: 'price', type: FieldType.NUMBER },
      { name: 'status', type: FieldType.SELECT },
    ]);
  });
});
