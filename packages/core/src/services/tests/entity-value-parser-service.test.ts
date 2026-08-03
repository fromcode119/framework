import { describe, expect, it } from 'vitest';
import { EntityValueParserService } from '@core/services/entity-value-parser-service';
import type { ICollection } from '@core/interfaces/collection.interface';
import { EntityParseMode } from '@core/enums/entity-parse-mode.enum';

describe('EntityValueParserService', () => {
  const collection: ICollection = {
    slug: 'test_records',
    fields: [
      { name: 'title', type: 'text', required: true },
      { name: 'count', type: 'number', defaultValue: 1 },
      { name: 'enabled', type: 'checkbox', defaultValue: true },
      { name: 'tags', type: 'array' },
      { name: 'owner', type: 'relationship', relationTo: 'users' },
    ],
    inputAliases: [
      { field: 'title', from: ['name', 'payload.title'] },
      { field: 'owner', from: ['userId'] },
    ],
  };

  it('parses entity fields from aliases and field metadata', () => {
    const parsed = new EntityValueParserService().parseCollectionInput(collection, {
      name: ' Example ',
      count: '4',
      enabled: 'false',
      tags: 'one,two',
      userId: { id: 7 },
      ignored: 'value',
    }, { mode: EntityParseMode.CREATE });

    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toEqual({
      title: 'Example',
      count: 4,
      enabled: false,
      tags: ['one', 'two'],
      owner: 7,
    });
  });

  it('reports required fields on create', () => {
    const parsed = new EntityValueParserService().parseCollectionInput(collection, {}, { mode: EntityParseMode.CREATE });

    expect(parsed.errors).toEqual([{ field: 'title', message: 'Field "title" is required' }]);
    expect(parsed.data.count).toBe(1);
    expect(parsed.data.enabled).toBe(true);
  });

  it('keeps update payloads partial', () => {
    const parsed = new EntityValueParserService().parseCollectionInput(collection, {
      enabled: '0',
    }, { mode: EntityParseMode.UPDATE });

    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toEqual({ enabled: false });
  });
});
