import { describe, expect, it } from 'vitest';
import { PublicAssetUrlUtils } from '@fromcode119/core/client';

describe('PublicAssetUrlUtils.themeAssetStamp', () => {
  it('prefers the api-derived assetVersion so server head and client loader stamp the same URL', () => {
    expect(PublicAssetUrlUtils.themeAssetStamp({ assetVersion: '7e90d5e204e3', version: '0.1.24' })).toBe('7e90d5e204e3');
  });
  it('falls back to the manifest version, and to an empty stamp for no theme', () => {
    expect(PublicAssetUrlUtils.themeAssetStamp({ version: '0.1.24' })).toBe('0.1.24');
    expect(PublicAssetUrlUtils.themeAssetStamp({ assetVersion: '  ', version: '0.1.24' })).toBe('0.1.24');
    expect(PublicAssetUrlUtils.themeAssetStamp(null)).toBe('');
  });
});
