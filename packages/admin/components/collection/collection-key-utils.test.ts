import { describe, expect, it } from 'vitest';
import { CollectionKeyUtils } from './collection-key-utils';

describe('CollectionKeyUtils.resolveSourceSlugs', () => {
  const mockCollections = [
    { slug: 'posts', shortSlug: 'posts', pluginSlug: 'cms' },
    { slug: 'pages', shortSlug: 'pages', pluginSlug: 'cms' },
  ];

  it('resolves multiple relation targets from array values', () => {
    expect(CollectionKeyUtils.resolveSourceSlugs(['posts', 'pages'], mockCollections)).toEqual(['posts', 'pages']);
  });

  it('resolves multiple relation targets from comma-delimited values', () => {
    expect(CollectionKeyUtils.resolveSourceSlugs('posts,pages', mockCollections)).toEqual(['posts', 'pages']);
  });
});