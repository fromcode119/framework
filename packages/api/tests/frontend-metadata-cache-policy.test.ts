import { describe, expect, it } from 'vitest';
import { FrontendMetadataCachePolicy } from '@api/services/system/frontend-metadata-cache-policy';

describe('FrontendMetadataCachePolicy', () => {
  it('shares a storefront answer, where the Host picks the site', () => {
    expect(FrontendMetadataCachePolicy.resolve('storefront', false)).toBe('public, max-age=30, stale-while-revalidate=300');
  });

  it('never shares or reuses a console answer, where the session picks the site', () => {
    expect(FrontendMetadataCachePolicy.resolve('admin', false)).toBe('private, no-cache');
    expect(FrontendMetadataCachePolicy.resolve('api-key', false)).toBe('private, no-cache');
  });

  it('shares an answer no site is bound to', () => {
    expect(FrontendMetadataCachePolicy.resolve(undefined, false)).toBe('public, max-age=30, stale-while-revalidate=300');
  });

  it('stores nothing for a site that is not published, on any surface', () => {
    expect(FrontendMetadataCachePolicy.resolve('storefront', true)).toBe('no-store');
    expect(FrontendMetadataCachePolicy.resolve('admin', true)).toBe('no-store');
  });
});
