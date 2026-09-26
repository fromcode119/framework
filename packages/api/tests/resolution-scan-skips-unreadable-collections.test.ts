import { describe, expect, it } from 'vitest';
import { ResolutionCollectionScanService } from '@api/services/helpers/resolution-collection-scan-service';

/**
 * An anonymous page lookup asked every slug-bearing collection for the path — including ones the
 * visitor may not read, whose `find` could only be refused (and was logged, once per candidate path).
 * Now such a collection is not asked; the page is still found where the visitor may read.
 */
describe('route resolution and collections the visitor may not read', () => {
  const pages = { slug: 'pages', access: { read: () => true } };
  const forms = { slug: 'forms-list', access: { read: () => false } };

  const scan = (asked: string[]) => new ResolutionCollectionScanService(
    { findOne: async () => null },
    { find: async (collection: { slug: string }) => { asked.push(collection.slug); return { docs: collection.slug === 'pages' ? [{ id: 1, slug: 'about' }] : [] }; } } as any,
    { getCollectionFlags: () => ({ hasSlug: true, hasCustomPermalink: false }) } as any,
  );

  const context = (user: unknown) => ({
    entries: [{ collection: forms, pluginSlug: 'plugin-a' }, { collection: pages, pluginSlug: 'plugin-b' }],
    pathCandidates: ['about'], slugCandidates: ['about'],
    withLocale: (query: Record<string, unknown>) => query,
    options: { user, preview: false },
    presentSlug: (doc: unknown) => doc, presentCustom: (doc: unknown) => doc,
  }) as any;

  it('does not ask a collection that refuses the visitor, and still finds the page', async () => {
    const asked: string[] = [];
    const result = await scan(asked).scanPriority(context(null));
    expect(asked).toEqual(['pages']);
    expect(result).toMatchObject({ type: 'pages', plugin: 'plugin-b', doc: { id: 1 } });
  });

  it('still asks it for an admin, who may read it', async () => {
    const asked: string[] = [];
    await scan(asked).scanPriority(context({ roles: ['admin'] }));
    expect(asked).toEqual(['forms-list', 'pages']);
  });
});
