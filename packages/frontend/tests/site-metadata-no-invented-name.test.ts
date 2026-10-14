import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';

/** A site without a head-data provider has no brand name, and the head must not make one up. */
describe('ResolvedContentMetadata.buildSiteMetadata', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sets no site name or title template when nothing provides one', async () => {
    vi.spyOn(ResolvedContentMetadata, 'fetchSite').mockResolvedValue(null);
    const metadata = await ResolvedContentMetadata.buildSiteMetadata();
    expect(metadata.title).toBeUndefined();
    expect(metadata.openGraph?.siteName).toBeUndefined();
    expect(JSON.stringify(metadata)).not.toContain('Home');
  });

  it('uses the provided site name as the title template', async () => {
    vi.spyOn(ResolvedContentMetadata, 'fetchSite').mockResolvedValue({ siteName: 'Zen Myself' } as never);
    const metadata = await ResolvedContentMetadata.buildSiteMetadata();
    expect(metadata.title).toEqual({ default: 'Zen Myself', template: '%s | Zen Myself' });
  });
});
