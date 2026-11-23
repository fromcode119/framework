import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';
import { HeadSiteTags } from '@/lib/head-site-tags';

describe('HeadSiteTags', () => {
  it('adds nothing when the provider states none of them', () => {
    expect(HeadSiteTags.keywords(null)).toBeUndefined();
    expect(HeadSiteTags.verification({} as never)).toBeUndefined();
    expect(HeadSiteTags.other({} as never)).toEqual({});
    expect(HeadSiteTags.twitterWanted({} as never)).toBe(true);
  });
  it('turns stated values into Next metadata', () => {
    const head = { keywords: 'zen, calm ,', googleVerification: 'g-123', bingVerification: 'b-456', facebookAppId: '999', twitterCardsEnabled: false } as never;
    expect(HeadSiteTags.keywords(head)).toEqual(['zen', 'calm']);
    expect(HeadSiteTags.verification(head)).toEqual({ google: 'g-123', other: { 'msvalidate.01': 'b-456' } });
    expect(HeadSiteTags.other(head)).toEqual({ 'fb:app_id': '999' });
    expect(HeadSiteTags.twitterWanted(head)).toBe(false);
  });
});

describe('ResolvedContentMetadata.buildSiteMetadata with site-wide head tags', () => {
  afterEach(() => vi.restoreAllMocks());
  it('puts the ownership checks and app id into the server metadata and drops Twitter cards when off', async () => {
    vi.spyOn(ResolvedContentMetadata, 'fetchSite').mockResolvedValue({ siteName: 'Zen', googleVerification: 'g-123', facebookAppId: '999', twitterCardsEnabled: false } as never);
    const metadata = await ResolvedContentMetadata.buildSiteMetadata();
    expect(metadata.verification).toEqual({ google: 'g-123' });
    expect(metadata.other).toEqual({ 'fb:app_id': '999' });
    expect(metadata.twitter).toBeUndefined();
  });
});
