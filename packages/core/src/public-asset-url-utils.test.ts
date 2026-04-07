import { describe, expect, it } from 'vitest';
import { PublicAssetUrlUtils } from './public-asset-url-utils';

describe('PublicAssetUrlUtils', () => {
  it('normalizes versioned upload paths to the public uploads path', () => {
    expect(
      PublicAssetUrlUtils.resolveMediaUrl('/api/v1/uploads/cosmic-box-love.png', 'http://api.framework.local'),
    ).toBe('http://api.framework.local/uploads/cosmic-box-love.png');
  });

  it('normalizes absolute versioned upload urls to the public uploads path', () => {
    expect(
      PublicAssetUrlUtils.resolveMediaUrl('http://api.framework.local/api/v1/uploads/cosmic-box-love.png'),
    ).toBe('http://api.framework.local/uploads/cosmic-box-love.png');
  });

  it('treats bare filenames as upload assets', () => {
    expect(
      PublicAssetUrlUtils.resolveMediaUrl('cosmic-box-love.png', 'http://api.framework.local'),
    ).toBe('http://api.framework.local/uploads/cosmic-box-love.png');
  });
});