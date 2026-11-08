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

  it('asks which collections hold the path eight at a time, and the first in order still wins', async () => {
    let inFlight = 0; let widest = 0; let queried = 0;
    const slow = {
      findOne: async () => null,
      eq: (column: unknown, value: unknown) => ({ column, value }),
      or: (...clauses: unknown[]) => clauses,
      find: async () => {
        const call = queried++;
        inFlight += 1; widest = Math.max(widest, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        // The 11th and 13th collections both hold the path; the 11th is first in order.
        return call === 10 || call === 12 ? [{ id: 1 }] : [];
      },
    };
    const restFinds: string[] = [];
    const service = new ResolutionCollectionScanService(
      slow,
      { find: async (c: { slug: string }) => { restFinds.push(c.slug); return { docs: [{ id: c.slug === 'c10' ? 10 : 12 }] }; } } as any,
      flags,
    );
    const entries = Array.from({ length: 20 }, (_, i) => ({ collection: collection(`c${i}`), pluginSlug: `p${i}` }));
    const result = await service.scanPriority(context(entries));
    expect(result).toMatchObject({ type: 'c10', doc: { id: 10 } });
    expect(widest).toBe(8);
    // The window holding the match is asked in full, and the next window is never asked.
    expect(queried).toBe(16);
  });
});
