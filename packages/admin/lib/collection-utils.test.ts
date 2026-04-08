import { describe, it, expect } from 'vitest';
import { AdminCollectionUtils } from './collection-utils';

describe('resolveCollection', () => {
  const mockCollections: any[] = [
    { slug: 'plugin-a-entries', shortSlug: 'entries', pluginSlug: 'plugin-a' },
    { slug: 'plugin-b-items', shortSlug: 'items', pluginSlug: 'plugin-b' }
  ];

  it('should resolve by full slug', () => {
    const result = AdminCollectionUtils.resolveCollection(mockCollections, 'plugin-a', 'plugin-a-entries');
    expect(result?.slug).toBe('plugin-a-entries');
  });

  it('should resolve by short slug', () => {
    const result = AdminCollectionUtils.resolveCollection(mockCollections, 'plugin-a', 'entries');
    expect(result?.slug).toBe('plugin-a-entries');
  });

  it('should return null for non-matching plugin', () => {
    const result = AdminCollectionUtils.resolveCollection(mockCollections, 'other', 'entries');
    expect(result).toBeUndefined();
  });

  it('should resolve plugin collections from the global collections route', () => {
    const result = AdminCollectionUtils.resolveCollection(mockCollections, 'collections', 'plugin-a-entries');
    expect(result?.slug).toBe('plugin-a-entries');
  });

  it('should resolve global collection aliases from the global collections route', () => {
    const result = AdminCollectionUtils.resolveCollection(mockCollections, 'collections', '@plugin-a/entries');
    expect(result?.slug).toBe('plugin-a-entries');
  });
});

describe('generatePreviewUrl', () => {
  const mockCollection: any = { 
    slug: 'plugin-a-entries', 
    shortSlug: 'entries', 
    pluginSlug: 'plugin-a' 
  };

  it('should return # if no record or frontendUrl', () => {
    expect(AdminCollectionUtils.generatePreviewUrl('', {}, mockCollection)).toBe('#');
    expect(AdminCollectionUtils.generatePreviewUrl('http://test.com', null, mockCollection)).toBe('#');
  });

  it('should use customPermalink if available', () => {
    const record = { customPermalink: 'my-custom-path' };
    const url = AdminCollectionUtils.generatePreviewUrl('http://test.com', record, mockCollection);
    expect(url).toBe('http://test.com/my-custom-path?preview=1');
  });

  it('should handle leading slash in customPermalink', () => {
    const record = { customPermalink: '/my-custom-path' };
    const url = AdminCollectionUtils.generatePreviewUrl('http://test.com', record, mockCollection);
    expect(url).toBe('http://test.com/my-custom-path?preview=1');
  });

  it('should fallback to slug with default structure', () => {
    const record = { slug: 'sample-entry' };
    const url = AdminCollectionUtils.generatePreviewUrl('http://test.com', record, mockCollection);
    expect(url).toBe('http://test.com/sample-entry?preview=1');
  });

  it('should respect permalinkStructure replacements', () => {
    const record = { slug: 'test-post', createdAt: '2026-02-04T12:00:00Z' };
    const structure = '/:year/:month/:slug';
    const url = AdminCollectionUtils.generatePreviewUrl('http://test.com', record, mockCollection, structure);
    expect(url).toBe('http://test.com/2026/02/test-post?preview=1');
  });

  it('should include collection prefix from plugin settings', () => {
    const record = { slug: 'sample-entry' };
    const collectionWithPrefix: any = {
      ...mockCollection,
      admin: { previewPrefixSettingsKey: 'entriesPrefix' }
    };
    const pluginSettings = { entriesPrefix: 'library' };
    const url = AdminCollectionUtils.generatePreviewUrl('http://test.com', record, collectionWithPrefix, '/:slug', pluginSettings);
    expect(url).toBe('http://test.com/library/sample-entry?preview=1');
  });

  it('should handle nested collection prefixes', () => {
    const record = { slug: 'sample-entry' };
    const collectionWithPrefix: any = {
      ...mockCollection,
      admin: { previewPrefixSettingsKey: 'entriesPrefix' }
    };
    const pluginSettings = { entriesPrefix: '/library/featured' };
    const url = AdminCollectionUtils.generatePreviewUrl('http://test.com', record, collectionWithPrefix, '/:slug', pluginSettings);
    expect(url).toBe('http://test.com/library/featured/sample-entry?preview=1');
  });

  it('should prepend collection prefix to customPermalink if missing', () => {
    const record = { customPermalink: 'my-custom-path' };
    const collectionWithPrefix: any = {
      ...mockCollection,
      admin: { previewPrefixSettingsKey: 'entriesPrefix' }
    };
    const pluginSettings = { entriesPrefix: 'library' };
    const url = AdminCollectionUtils.generatePreviewUrl('http://test.com', record, collectionWithPrefix, '/:slug', pluginSettings);
    expect(url).toBe('http://test.com/library/my-custom-path?preview=1');
  });

  it('should allow absolute customPermalink to bypass the collection prefix', () => {
    const record = { customPermalink: '/my-custom-path' };
    const collectionWithPrefix: any = {
      ...mockCollection,
      admin: { previewPrefixSettingsKey: 'entriesPrefix' }
    };
    const pluginSettings = { entriesPrefix: 'library' };
    const url = AdminCollectionUtils.generatePreviewUrl('http://test.com', record, collectionWithPrefix, '/:slug', pluginSettings);
    expect(url).toBe('http://test.com/my-custom-path?preview=1');
  });

  it('should not prepend collection prefix if it is already in customPermalink', () => {
    const record = { customPermalink: 'library/my-custom-path' };
    const collectionWithPrefix: any = {
      ...mockCollection,
      admin: { previewPrefixSettingsKey: 'entriesPrefix' }
    };
    const pluginSettings = { entriesPrefix: 'library' };
    const url = AdminCollectionUtils.generatePreviewUrl('http://test.com', record, collectionWithPrefix, '/:slug', pluginSettings);
    expect(url).toBe('http://test.com/library/my-custom-path?preview=1');
  });
});
