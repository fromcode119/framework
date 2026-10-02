import { describe, expect, it } from 'vitest';
import { EntityObjectMapperService } from '@core/services/entity-object-mapper-service';
import { EntityMetadataService } from '@core/services/entity-metadata-service';
import { EntityColumn } from '@core/entity-column';
import { BaseEntity } from '@core/base/base-entity';
import type { IEntityFieldsConfig } from '@core/entity/interfaces/entity-fields-config.interface';

/**
 * Each field config's plan (split source paths, named transforms) is now worked out once and reused
 * for every row; each class's resolved fields too. A mapped row must be what it was when both were
 * rebuilt per row.
 */
const FIELDS: IEntityFieldsConfig = {
  id: { type: 'number' },
  title: { type: 'string', from: ['name', 'meta.title'] },
  label: { type: 'string', fallbackTo: 'title' },
  price: { type: 'number', transform: ['round2', 'min0'] },
  code: { type: 'string', transform: 'uppercase' },
  tags: { type: 'array', transform: 'stringArray' },
  note: { type: 'string', optional: true },
  deep: { type: 'raw', from: ['a.b.c'] },
  active: { type: 'boolean', default: true },
  data: { type: 'json' },
} as unknown as IEntityFieldsConfig;

describe('EntityObjectMapperService.map with a reused plan', () => {
  it('maps every shape of field the same on the first row and on every later one', () => {
    const rows = [
      { id: '7', name: '', meta: { title: 'From meta' }, price: '-3.456', code: 'ab', tags: '["x",2,""]', note: '', a: { b: { c: [1] } }, data: '{"k":1}' },
      { id: 8, name: 'Named', price: 10.005, code: null, tags: null, note: 'kept', a: { b: null }, active: false, data: { k: 2 } },
      '{"id":9,"name":"From JSON text"}',
      null,
    ];
    const first = rows.map((row) => EntityObjectMapperService.map(row, FIELDS));
    const again = rows.map((row) => EntityObjectMapperService.map(row, FIELDS));
    expect(again).toEqual(first);
    expect(first[0]).toEqual({
      id: 7, title: 'From meta', label: 'From meta', price: 0, code: 'AB', tags: ['x', '2'], note: undefined,
      deep: [1], active: true, data: { k: 1 },
    });
    expect(first[1]).toMatchObject({ id: 8, title: 'Named', label: 'Named', price: 10.01, code: '', tags: [], note: 'kept', deep: null, active: false });
    expect(first[2]).toMatchObject({ id: 9, title: 'From JSON text' });
    expect(first[3]).toMatchObject({ id: 0, title: '', active: true });
  });
});

describe('EntityMetadataService.resolveFields, kept per class', () => {
  it('returns the same fields again, and a field declared later is seen', () => {
    class Product extends BaseEntity<{ name: string }> {}
    EntityColumn.text()(Product.prototype, 'name');
    const first = EntityMetadataService.resolveFields(Product);
    expect(Object.keys(first)).toEqual(['name']);
    expect(EntityMetadataService.resolveFields(Product)).toBe(first);

    EntityColumn.number()(Product.prototype, 'price');
    expect(Object.keys(EntityMetadataService.resolveFields(Product))).toEqual(['name', 'price']);
  });

  it('a subclass declared after its parent was resolved sees both', () => {
    class Base extends BaseEntity<object> {}
    EntityColumn.text()(Base.prototype, 'id');
    expect(Object.keys(EntityMetadataService.resolveFields(Base))).toEqual(['id']);
    class Child extends Base {}
    EntityColumn.text()(Child.prototype, 'extra');
    expect(Object.keys(EntityMetadataService.resolveFields(Child))).toEqual(['id', 'extra']);
    expect(Object.keys(EntityMetadataService.resolveFields(Base))).toEqual(['id']);
  });
});
