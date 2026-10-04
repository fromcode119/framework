import { describe, expect, it } from 'vitest';
import { MarketplaceArtifactDigest } from '@core/marketplace/marketplace-artifact-digest';

describe('MarketplaceArtifactDigest.assertMatches', () => {
  const bytes = Buffer.from('package bytes');
  const digest = MarketplaceArtifactDigest.of(bytes);

  it('accepts a download that matches the published checksum, in any case', () => {
    expect(() => MarketplaceArtifactDigest.assertMatches(bytes, digest, 'plugin "demo"')).not.toThrow();
    expect(() => MarketplaceArtifactDigest.assertMatches(bytes, digest.toUpperCase(), 'plugin "demo"')).not.toThrow();
  });

  it('refuses a download that does not match', () => {
    expect(() => MarketplaceArtifactDigest.assertMatches(Buffer.from('swapped'), digest, 'plugin "demo"'))
      .toThrow(/does not match the checksum/);
  });

  it('refuses when the catalogue published no checksum at all', () => {
    for (const missing of ['', '  ', undefined, null]) {
      expect(() => MarketplaceArtifactDigest.assertMatches(bytes, missing, 'plugin "demo"')).toThrow(/published no checksum/);
    }
  });
});
