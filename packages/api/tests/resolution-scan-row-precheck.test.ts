import { describe, expect, it } from 'vitest';
import { ResolutionCollectionScanService } from '@api/services/helpers/resolution-collection-scan-service';

/**
 * A path nothing holds used to cost, for every slug-bearing collection, a readability check and one full
 * REST find per candidate — each with its own access checks, several a round trip to a plugin process.
 * Now one indexed query on the raw table asks whether any row holds the value first.
 */
describe('route resolution asks the table before the REST find', () => {
  const collection = (slug: string) => ({
    slug, tableName: slug, access: { read: () => true },
    fields: [{ name: 'slug', type: 'text' }, { name: 'customPermalink', type: 'text' }],
  });
  /** `holdsAt`: which pre-check calls (0-based, in collection order) find a row. */
  const db = (holdsAt: number[], queried: number[]) => ({
    findOne: async () => null,
    eq: (column: unknown, value: unknown) => ({ column, value }),
    or: (...clauses: unknown[]) => clauses,
    find: async () => {
      const call = queried.length;
      queried.push(call);
      return holdsAt.includes(call) ? [{ id: 1 }] : [];
    },
  });
  const context = (entries: unknown[]) => ({
    entries, pathCandidates: ['/about', 'about'], slugCandidates: ['about'],
    withLocale: (query: Record<string, unknown>) => query,
    options: { user: null, preview: false },
    presentSlug: (doc: unknown) => doc, presentCustom: (doc: unknown) => doc,
  }) as any;
  const flags = { getCollectionFlags: () => ({ hasSlug: true, hasCustomPermalink: true }) } as any;

  it('makes no REST find when no table holds the path', async () => {
    const restFinds: string[] = [];
    const queried: number[] = [];
    const service = new ResolutionCollectionScanService(
      db([], queried),
      { find: async (c: { slug: string }) => { restFinds.push(c.slug); return { docs: [] }; } } as any,
      flags,
    );
    const result = await service.scanPriority(context([{ collection: collection('pages'), pluginSlug: 'a' }, { collection: collection('posts'), pluginSlug: 'b' }]));
    expect(result).toBeNull();
    expect(queried).toHaveLength(2);
    expect(restFinds).toEqual([]);
  });

  it('still resolves through the REST find where a row holds it', async () => {
    const restFinds: string[] = [];
    const service = new ResolutionCollectionScanService(
      db([1], []),
      { find: async (c: { slug: string }) => { restFinds.push(c.slug); return { docs: c.slug === 'pages' ? [{ id: 7 }] : [] }; } } as any,
      flags,
    );
    const result = await service.scanPriority(context([{ collection: collection('posts'), pluginSlug: 'b' }, { collection: collection('pages'), pluginSlug: 'a' }]));
    expect(result).toMatchObject({ type: 'pages', doc: { id: 7 } });
    expect(restFinds.every((slug) => slug === 'pages')).toBe(true);
  });
});
