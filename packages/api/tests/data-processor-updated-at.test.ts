import { describe, expect, it } from 'vitest';
import { DataProcessorService } from '@api/services/data-processor-service';

/**
 * The regression this guards: `updatedAt` was dropped from incoming data as auto-managed, and nothing
 * managed it — the column DEFAULT only fires on insert — so an edited record kept its creation time as
 * "Updated" forever.
 */
describe('DataProcessorService — updatedAt', () => {
  const collection: any = { slug: 'pages', fields: [{ name: 'title', type: 'text' }] };
  const table: any = { title: {}, updatedAt: {}, createdAt: {} };
  const localeContext = { locale: 'en', defaultLocale: 'en' };
  const service = new DataProcessorService(null, { parseLocaleMap: () => null, isJsonStorageField: () => false } as any);

  it('stamps updatedAt on an update', async () => {
    const before = Date.now();
    const out = await service.processIncomingData(collection, { title: 'x', updatedAt: '2020-01-01' }, table, { existingRecord: { id: 1 }, localeContext });
    expect(out.title).toBe('x');
    expect(out.updatedAt).toBeInstanceOf(Date);
    expect(out.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('leaves it to the column default on a create', async () => {
    const out = await service.processIncomingData(collection, { title: 'x' }, table, { localeContext });
    expect(out).not.toHaveProperty('updatedAt');
  });

  it('keeps an authorized explicit override', async () => {
    const out = await service.processIncomingData(collection, { updatedAt: '2020-01-01' }, table, { existingRecord: { id: 1 }, localeContext, overrideFields: new Set(['updatedAt']) });
    expect(out.updatedAt).toBe('2020-01-01');
  });

  it('does nothing for a table without the column', async () => {
    const out = await service.processIncomingData(collection, { title: 'x' }, { title: {} }, { existingRecord: { id: 1 }, localeContext });
    expect(out).not.toHaveProperty('updatedAt');
  });
});
