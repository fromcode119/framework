import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';

/**
 * The record fields a head-data provider asks for are forwarded on its query. A picked image is a
 * related record and arrives as its numeric id; dropping it as "not a string" meant every post's
 * chosen share image was ignored and the share card showed the site default.
 */
describe('ResolvedContentMetadata head-data record fields', () => {
  afterEach(() => vi.restoreAllMocks());

  const queryFor = async (record: Record<string, unknown>): Promise<URLSearchParams> => {
    const provider = { pluginSlug: 'seo', headDataPath: 'head-data', recordFields: ['ogImage', 'seoTitle', 'metaRobots'] };
    vi.spyOn(ResolvedContentMetadata as any, 'resolveHeadDataProvider').mockResolvedValue(provider);
    const seen: string[] = [];
    vi.spyOn(ResolvedContentMetadata as any, 'headDataCache').mockImplementation(async (query: unknown) => {
      seen.push(String(query));
      return null;
    });
    await ResolvedContentMetadata.buildEnriched(record, 'posts', '/blog/a-post');
    return new URLSearchParams(seen[0]);
  };

  it('forwards a numeric field such as a picked image id', async () => {
    const query = await queryFor({ ogImage: 9640, seoTitle: 'A post' });
    expect(query.get('ogImage')).toBe('9640');
    expect(query.get('seoTitle')).toBe('A post');
  });

  it('still forwards text, and leaves out empty, non-finite and object values', async () => {
    const query = await queryFor({ ogImage: Number.NaN, seoTitle: '  ', metaRobots: { index: true } });
    expect(query.has('ogImage')).toBe(false);
    expect(query.has('seoTitle')).toBe(false);
    expect(query.has('metaRobots')).toBe(false);
    expect(query.get('url')).toBe('/blog/a-post');
  });
});
