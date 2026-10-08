import { describe, expect, it, vi } from 'vitest';
import { RestReadController } from '@api/controllers/rest/rest-read-controller';

/**
 * A list read ran `count(*)` beside every query, for a `totalDocs` that a page which came back short
 * already states: the rows before it and the rows on it. Only a full page, or one past the end, counts.
 * The total and the page numbers must be exactly what counting gives.
 */
describe('RestReadController list total', () => {
  const collection: any = { slug: 'fcp_example_items', fields: [{ name: 'title', type: 'text' }] };
  const read = async (matching: number, query: Record<string, string>) => {
    const all = Array.from({ length: matching }, (_, i) => ({ id: i + 1, title: `t${i + 1}` }));
    const db: any = {
      find: vi.fn(async (_table: unknown, options: any) => all.slice(options.offset, options.offset + options.limit)),
      count: vi.fn(async () => all.length),
      eq: vi.fn(), and: vi.fn((...a: unknown[]) => a.filter(Boolean)[0]), or: vi.fn(), inArray: vi.fn(), desc: vi.fn(), asc: vi.fn(),
    };
    const runtime: any = {
      db,
      logger: { error: vi.fn(), debug: vi.fn() },
      accessPolicy: { resolveReadConstraints: async () => ({}), seesUnpublished: async () => true, readsEverything: async () => true },
      localization: { getLocaleContext: async () => ({ chain: ['en'], defaultLocale: 'en' }) },
      processor: { filterHiddenFields: (_c: unknown, rows: unknown) => rows },
    };
    const result: any = await new RestReadController(runtime).find(collection, { query });
    return { result, counted: db.count.mock.calls.length };
  };

  it.each([
    ['a short first page', 7, { limit: '10' }, { totalDocs: 7, totalPages: 1, page: 1, docs: 7 }, 0],
    ['an empty result', 0, { limit: '10' }, { totalDocs: 0, totalPages: 0, page: 1, docs: 0 }, 0],
    ['a short last page', 25, { limit: '10', page: '3' }, { totalDocs: 25, totalPages: 3, page: 3, docs: 5 }, 0],
    ['a full page', 25, { limit: '10' }, { totalDocs: 25, totalPages: 3, page: 1, docs: 10 }, 1],
    ['an exactly full last page', 20, { limit: '10', page: '2' }, { totalDocs: 20, totalPages: 2, page: 2, docs: 10 }, 1],
    ['a page past the end', 5, { limit: '10', page: '3' }, { totalDocs: 5, totalPages: 1, page: 3, docs: 0 }, 1],
  ])('%s: the same total as counting, counting only when it must', async (_label, matching, query, expected, counts) => {
    const { result, counted } = await read(matching, query);
    expect({ totalDocs: result.totalDocs, totalPages: result.totalPages, page: result.page, docs: result.docs.length }).toEqual(expected);
    expect(counted).toBe(counts);
  });
});
