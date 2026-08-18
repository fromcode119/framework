import { describe, it, expect } from 'vitest';
import { DataProcessorService } from '@api/services/data-processor-service';
import { LocalizationService } from '@api/services/localization-service';

const collection: any = {
  slug: 'products',
  fields: [
    { name: 'shortDescription', type: 'textarea', localized: true },
    { name: 'title', type: 'text', localized: true },
    { name: 'contentBlocks', type: 'json', localized: true },
  ],
};

const table: any = { shortDescription: {}, title: {}, contentBlocks: {} };
const localeContext = { locale: 'bg', defaultLocale: 'bg' };

const service = new DataProcessorService(null, new LocalizationService(null));

const process = (data: any, existingRecord?: any) =>
  service.processIncomingData(collection, data, table, { existingRecord, localeContext });

describe('DataProcessorService — localized scalar-field write guard (the product-8 shortDescription wipe)', () => {
  it('does not write a bare object into a scalar locale slot — preserves the stored map', async () => {
    const existingRecord = { shortDescription: JSON.stringify({ bg: 'Старо описание' }) };
    const out = await process({ shortDescription: {} }, existingRecord);
    expect(out).not.toHaveProperty('shortDescription');
  });

  it('does not write a non-locale-map object into a scalar locale slot', async () => {
    const existingRecord = { shortDescription: JSON.stringify({ bg: 'Старо' }) };
    const out = await process({ shortDescription: { foo: 'bar' } }, existingRecord);
    expect(out).not.toHaveProperty('shortDescription');
  });

  it('does not write an array into a scalar locale slot', async () => {
    const existingRecord = { title: JSON.stringify({ bg: 'Старо заглавие' }) };
    const out = await process({ title: ['junk'] }, existingRecord);
    expect(out).not.toHaveProperty('title');
  });

  it('does not seed a junk locale map on insert (no existing record)', async () => {
    const out = await process({ shortDescription: {} });
    expect(out).not.toHaveProperty('shortDescription');
  });

  it('does not wipe a legacy plain-string stored value when junk arrives', async () => {
    // parseLocaleMap(existing) is null for a legacy plain string, so a written-back "{}" would
    // destroy it — the guard must skip the field entirely, not re-serialize the (empty) map.
    const existingRecord = { shortDescription: 'legacy plain value' };
    const out = await process({ shortDescription: {} }, existingRecord);
    expect(out).not.toHaveProperty('shortDescription');
  });

  it('still clears a locale slot with an empty STRING', async () => {
    const existingRecord = { shortDescription: JSON.stringify({ bg: 'Старо', en: 'Old' }) };
    const out = await process({ shortDescription: '' }, existingRecord);
    expect(JSON.parse(out.shortDescription)).toEqual({ bg: '', en: 'Old' });
  });

  it('still writes a plain string into the requested locale slot, merging the stored map', async () => {
    const existingRecord = { shortDescription: JSON.stringify({ en: 'Old' }) };
    const out = await process({ shortDescription: 'Ново описание' }, existingRecord);
    expect(JSON.parse(out.shortDescription)).toEqual({ en: 'Old', bg: 'Ново описание' });
  });

  it('still merges a submitted locale map into the stored map', async () => {
    const existingRecord = { shortDescription: JSON.stringify({ en: 'Old' }) };
    const out = await process({ shortDescription: { bg: 'Ново' } }, existingRecord);
    expect(JSON.parse(out.shortDescription)).toEqual({ en: 'Old', bg: 'Ново' });
  });

  it('still stores an object in a JSON-storage localized field locale slot', async () => {
    const blocks = { blocks: [{ type: 'hero', data: { heading: 'Здравей' } }] };
    const out = await process({ contentBlocks: blocks });
    expect(out.contentBlocks).toEqual({ bg: blocks });
  });

  it('still merges a JSON-storage localized field with its stored locale map', async () => {
    const existingRecord = { contentBlocks: { en: { blocks: [] } } };
    const blocks = { blocks: [{ type: 'hero' }] };
    const out = await process({ contentBlocks: blocks }, existingRecord);
    expect(out.contentBlocks).toEqual({ en: { blocks: [] }, bg: blocks });
  });
});
