import { afterEach, describe, expect, it } from 'vitest';
import { PublicAssetUrlUtils } from '@core/utils/public-asset-url-utils';

/** A public asset address is opened by a visitor's browser — it must never name the internal api. */
describe('PublicAssetUrlUtils on a server with no api URL in Settings', () => {
  const original = process.env.INTERNAL_API_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_API_URL;
    else process.env.INTERNAL_API_URL = original;
  });

  it('builds a same-origin upload path instead of the internal api address', () => {
    process.env.INTERNAL_API_URL = 'http://api:3000';
    expect(PublicAssetUrlUtils.resolveMediaUrl('/uploads/brand.webp')).toBe('/uploads/brand.webp');
    expect(PublicAssetUrlUtils.resolveMediaUrl('brand.webp')).not.toContain('api:3000');
  });
});
