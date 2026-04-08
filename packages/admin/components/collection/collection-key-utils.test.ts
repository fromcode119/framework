import { describe, expect, it } from 'vitest';
import { CollectionKeyUtils } from './collection-key-utils';

describe('CollectionKeyUtils.resolveSourceSlugs', () => {
  const mockCollections = [
    { slug: 'alpha-records', shortSlug: 'alpha-records', pluginSlug: 'plugin-a' },
    { slug: 'beta-records', shortSlug: 'beta-records', pluginSlug: 'plugin-b' },
  ];

  it('resolves multiple relation targets from array values', () => {
    expect(CollectionKeyUtils.resolveSourceSlugs(['alpha-records', 'beta-records'], mockCollections)).toEqual(['alpha-records', 'beta-records']);
  });

  it('resolves multiple relation targets from comma-delimited values', () => {
    expect(CollectionKeyUtils.resolveSourceSlugs('alpha-records,beta-records', mockCollections)).toEqual(['alpha-records', 'beta-records']);
  });
});