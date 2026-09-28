import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({
  getLocaleRoutingConfig: vi.fn(async () => ({ strategy: 'query', enabledLocales: new Set<string>() })),
  resolveLocale: vi.fn(async () => 'en'),
  resolveDocWithPermalinkFallbackResult: vi.fn(),
}));
const metadata = vi.hoisted(() => ({ buildEnriched: vi.fn(async () => ({ title: 'Unsubscribe | Site' })) }));

vi.mock('@/lib/dynamic-page-resolver', () => ({ DynamicPageResolver: resolver }));
vi.mock('@/lib/resolved-content-metadata', () => ({ ResolvedContentMetadata: metadata }));

import { ThemedRouteMetadata } from '@/lib/themed-route-metadata';

/**
 * `/unsubscribe`, `/register`, `/forgot-password` and `/reset-password` render a theme's content page
 * but left the head to the root layout, so the tab read only the site name and there was no canonical.
 */
describe('ThemedRouteMetadata', () => {
  beforeEach(() => {
    resolver.resolveDocWithPermalinkFallbackResult.mockReset();
    metadata.buildEnriched.mockClear();
  });

  it('builds the head from the themed page the route renders', async () => {
    const doc = { id: 7, title: 'Unsubscribe' };
    resolver.resolveDocWithPermalinkFallbackResult.mockResolvedValue({ doc, type: 'page' });

    expect(await ThemedRouteMetadata.build('unsubscribe', {})).toEqual({ title: 'Unsubscribe | Site' });
    expect(resolver.resolveDocWithPermalinkFallbackResult).toHaveBeenCalledWith('unsubscribe', {}, 'en', 'query');
    expect(metadata.buildEnriched).toHaveBeenCalledWith(doc, 'page', '/unsubscribe');
  });

  it('leaves the site-wide head alone when the theme seeds no such page', async () => {
    resolver.resolveDocWithPermalinkFallbackResult.mockResolvedValue(null);
    expect(await ThemedRouteMetadata.build('register', {})).toEqual({});
    expect(metadata.buildEnriched).not.toHaveBeenCalled();
  });

  it('never fails the route when resolving the page throws', async () => {
    resolver.resolveDocWithPermalinkFallbackResult.mockRejectedValue(new Error('api down'));
    expect(await ThemedRouteMetadata.build('forgot-password', {})).toEqual({});
  });
});
