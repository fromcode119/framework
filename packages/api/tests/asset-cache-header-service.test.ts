import { describe, it, expect } from 'vitest';
import { AssetCacheHeaderService } from '@api/services/asset-cache-header-service';

describe('AssetCacheHeaderService.resolve', () => {
  it('pins content-hashed filenames as immutable (the name is the fingerprint)', () => {
    expect(AssetCacheHeaderService.resolve('/t/ui/index-CbnDAPiz.js')).toBe(AssetCacheHeaderService.IMMUTABLE);
    expect(AssetCacheHeaderService.resolve('/t/ui/vendor-chakra-T5GSHTrK.css')).toBe(AssetCacheHeaderService.IMMUTABLE);
    expect(AssetCacheHeaderService.resolve('/t/ui/course-enrolled-banner-B41I1hKj.js')).toBe(AssetCacheHeaderService.IMMUTABLE);
  });

  it('never pins the entry shim: its bytes change while its URL does not (the prod 404 outage)', () => {
    expect(AssetCacheHeaderService.resolve('/t/ui/bundle.js')).toBe(AssetCacheHeaderService.REVALIDATE);
    expect(AssetCacheHeaderService.resolve('/p/src/ui/frontend.js')).toBe(AssetCacheHeaderService.REVALIDATE);
    expect(AssetCacheHeaderService.resolve('/t/ui/fonts.css')).toBe(AssetCacheHeaderService.REVALIDATE);
  });

  it('keeps the long cache for assets that reference nothing that can disappear', () => {
    expect(AssetCacheHeaderService.resolve('/t/ui/fonts/montserrat-400-latin.woff2')).toBe(AssetCacheHeaderService.PRODUCTION);
    expect(AssetCacheHeaderService.resolve('/t/ui/logo.webp')).toBe(AssetCacheHeaderService.PRODUCTION);
  });

  it('decides on the underlying file for pre-compressed variants', () => {
    expect(AssetCacheHeaderService.resolve('/t/ui/index-CbnDAPiz.js.gz')).toBe(AssetCacheHeaderService.IMMUTABLE);
    expect(AssetCacheHeaderService.resolve('/t/ui/bundle.js.gz')).toBe(AssetCacheHeaderService.REVALIDATE);
  });

  it('ignores any ?v= the caller may have appended — a version is not a content fingerprint', () => {
    expect(AssetCacheHeaderService.resolve('/t/ui/bundle.js')).not.toBe(AssetCacheHeaderService.IMMUTABLE);
  });

  it('does not mistake ordinary hyphenated names for hashes', () => {
    // The regression that made this rule explicit: `-400-latin` looked hash-like.
    expect(AssetCacheHeaderService.resolve('/t/ui/montserrat-400-latin.woff2')).toBe(AssetCacheHeaderService.PRODUCTION);
    expect(AssetCacheHeaderService.resolve('/t/ui/vselenskiportal88-theme.css')).toBe(AssetCacheHeaderService.REVALIDATE);
  });

  it('recognises a hash that itself begins with a base64url dash', () => {
    expect(AssetCacheHeaderService.resolve('/t/ui/checkout-flow-form-field--f18VEHa.js')).toBe(AssetCacheHeaderService.IMMUTABLE);
  });

  it('is defensive about empty input rather than throwing', () => {
    expect(AssetCacheHeaderService.resolve('')).toBe(AssetCacheHeaderService.PRODUCTION);
  });
});
