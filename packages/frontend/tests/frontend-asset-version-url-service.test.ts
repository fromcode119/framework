import { describe, it, expect } from 'vitest';
import { FrontendAssetVersionUrlService } from '@/lib/frontend-asset-version-url-service';

describe('FrontendAssetVersionUrlService.appendVersion', () => {
  it('stamps the package version onto a relative manifest href', () => {
    expect(FrontendAssetVersionUrlService.appendVersion('bundle.js', '1.0.258')).toBe('bundle.js?v=1.0.258');
    expect(FrontendAssetVersionUrlService.appendVersion('/ui/app.css', '2.1.0')).toBe('/ui/app.css?v=2.1.0');
  });

  it('OVERRIDES a hand-written token — the outage: a manifest froze the entry at an old version', () => {
    expect(FrontendAssetVersionUrlService.appendVersion('bundle.js?v=1.0.250', '1.0.258')).toBe('bundle.js?v=1.0.258');
    expect(FrontendAssetVersionUrlService.appendVersion('https://cdn.x/ui/bundle.js?v=1.0.250', '1.0.258'))
      .toBe('https://cdn.x/ui/bundle.js?v=1.0.258');
  });

  it('preserves other query params while replacing only v', () => {
    expect(FrontendAssetVersionUrlService.appendVersion('img?w=360&q=60', '1.0.1')).toBe('img?w=360&q=60&v=1.0.1');
    expect(FrontendAssetVersionUrlService.appendVersion('img?w=360&v=old&q=60', '1.0.1')).toBe('img?w=360&v=1.0.1&q=60');
  });

  it('keeps a fragment intact', () => {
    expect(FrontendAssetVersionUrlService.appendVersion('sprite.svg#icon', '3.0.0')).toBe('sprite.svg?v=3.0.0#icon');
  });

  it('returns the url untouched when there is no version to stamp', () => {
    expect(FrontendAssetVersionUrlService.appendVersion('bundle.js', '')).toBe('bundle.js');
    expect(FrontendAssetVersionUrlService.appendVersion('bundle.js', undefined)).toBe('bundle.js');
    expect(FrontendAssetVersionUrlService.appendVersion('', '1.0.0')).toBe('');
  });
});
