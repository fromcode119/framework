import { describe, it, expect } from 'vitest';
import { resolveCollection, generatePreviewUrl } from './collection-utils';

describe('resolveCollection', () => {
  const mockCollections: any[] = [
    { slug: 'cms-posts', shortSlug: 'posts', pluginSlug: 'cms' },
    { slug: 'ecommerce-products', shortSlug: 'products', pluginSlug: 'ecommerce' }
  ];

  it('should resolve by full slug', () => {
    const result = resolveCollection(mockCollections, 'cms', 'cms-posts');
    expect(result?.slug).toBe('cms-posts');
  });

  it('should resolve by short slug', () => {
    const result = resolveCollection(mockCollections, 'cms', 'posts');
    expect(result?.slug).toBe('cms-posts');
  });

  it('should return null for non-matching plugin', () => {
    const result = resolveCollection(mockCollections, 'other', 'posts');
    expect(result).toBeUndefined();
  });
});

describe('generatePreviewUrl', () => {
  const mockCollection: any = { 
    slug: 'cms-posts', 
    shortSlug: 'posts', 
    pluginSlug: 'cms' 
  };

  it('should return # if no record or frontendUrl', () => {
    expect(generatePreviewUrl('', {}, mockCollection)).toBe('#');
    expect(generatePreviewUrl('http://test.com', null, mockCollection)).toBe('#');
  });

  it('should use customPermalink if available', () => {
    const record = { customPermalink: 'my-custom-path' };
    const url = generatePreviewUrl('http://test.com', record, mockCollection);
    expect(url).toBe('http://test.com/my-custom-path?preview=1&draft=1');
  });

  it('should handle leading slash in customPermalink', () => {
    const record = { customPermalink: '/my-custom-path' };
    const url = generatePreviewUrl('http://test.com', record, mockCollection);
    expect(url).toBe('http://test.com/my-custom-path?preview=1&draft=1');
  });

  it('should fallback to slug with default structure', () => {
    const record = { slug: 'test-post' };
    const url = generatePreviewUrl('http://test.com', record, mockCollection);
    expect(url).toBe('http://test.com/test-post?preview=1&draft=1');
  });

  it('should respect permalinkStructure replacements', () => {
    const record = { slug: 'test-post', createdAt: '2026-02-04T12:00:00Z' };
    const structure = '/:year/:month/:slug';
    const url = generatePreviewUrl('http://test.com', record, mockCollection, structure);
    expect(url).toBe('http://test.com/2026/02/test-post?preview=1&draft=1');
  });
});
