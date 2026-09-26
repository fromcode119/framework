import { describe, expect, it } from 'vitest';
import { PublicAssetUrlUtils } from '@core/utils/public-asset-url-utils';

describe('PublicAssetUrlUtils', () => {
  it('normalizes versioned upload paths to the public uploads path', () => {
    expect(
      PublicAssetUrlUtils.resolveMediaUrl('/api/v1/uploads/cosmic-box-love.png', 'https://api.example.test'),
    ).toBe('https://api.example.test/uploads/cosmic-box-love.png');
  });

  it('normalizes absolute versioned upload urls to the public uploads path', () => {
    expect(
      PublicAssetUrlUtils.resolveMediaUrl('https://api.example.test/api/v1/uploads/cosmic-box-love.png'),
    ).toBe('https://api.example.test/uploads/cosmic-box-love.png');
  });

  it('treats bare filenames as upload assets', () => {
    expect(
      PublicAssetUrlUtils.resolveMediaUrl('cosmic-box-love.png', 'https://api.example.test'),
    ).toBe('https://api.example.test/uploads/cosmic-box-love.png');
  });

  it('appends a version query to asset urls without one', () => {
    expect(
      PublicAssetUrlUtils.appendVersion('https://api.example.test/api/v1/themes/demo/ui/bundle.js', '1.2.3'),
    ).toBe('https://api.example.test/api/v1/themes/demo/ui/bundle.js?v=1.2.3');
  });

  it('preserves existing version query params', () => {
    expect(
      PublicAssetUrlUtils.appendVersion('https://api.example.test/api/v1/themes/demo/ui/bundle.js?v=9.9.9', '1.2.3'),
    ).toBe('https://api.example.test/api/v1/themes/demo/ui/bundle.js?v=9.9.9');
  });
});

describe('PublicAssetUrlUtils.resolveMediaUrl — external absolute URLs', () => {
  it('keeps an external image at the root of its host as it is', () => {
    expect(PublicAssetUrlUtils.resolveMediaUrl('https://cdn.example.net/og.jpg')).toBe('https://cdn.example.net/og.jpg');
    expect(PublicAssetUrlUtils.resolveMediaUrl('https://i.imgur.com/abc123.png')).toBe('https://i.imgur.com/abc123.png');
  });

  it('still normalises an absolute URL that points into uploads', () => {
    expect(PublicAssetUrlUtils.resolveMediaUrl('https://shop.example.com/uploads/a.jpg')).toBe('https://shop.example.com/uploads/a.jpg');
    expect(PublicAssetUrlUtils.resolveMediaUrl('https://shop.example.com/api/v1/uploads/a.jpg')).toBe('https://shop.example.com/uploads/a.jpg');
  });
});
