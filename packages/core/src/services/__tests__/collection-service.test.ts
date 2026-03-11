import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollectionService } from '../collection-service';
import type { Collection } from '../../types';

describe('CollectionService', () => {
  let service: CollectionService;

  beforeEach(() => {
    service = new CollectionService();
  });

  describe('resolveBySlug', () => {
    const collections: Collection[] = [
      {
        slug: 'cms-pages',
        shortSlug: 'pages',
        pluginSlug: 'cms',
        label: 'Pages'
      } as unknown as Collection,
      {
        slug: 'cms-posts',
        shortSlug: 'posts',
        pluginSlug: 'cms',
        label: 'Posts'
      } as unknown as Collection,
      {
        slug: 'ecommerce-products',
        shortSlug: 'products',
        pluginSlug: 'ecommerce',
        label: 'Products'
      } as unknown as Collection
    ];

    it('resolves by shortSlug', () => {
      const result = service.resolveBySlug(collections, 'cms', 'pages');
      expect(result).toBeDefined();
      expect(result?.slug).toBe('cms-pages');
    });

    it('resolves by full slug', () => {
      const result = service.resolveBySlug(collections, 'cms', 'cms-posts');
      expect(result).toBeDefined();
      expect(result?.slug).toBe('cms-posts');
    });

    it('matches plugin context', () => {
      const result = service.resolveBySlug(collections, 'ecommerce', 'products');
      expect(result).toBeDefined();
      expect(result?.slug).toBe('ecommerce-products');
    });

    it('returns undefined for non-matching plugin', () => {
      const result = service.resolveBySlug(collections, 'wrong-plugin', 'pages');
      expect(result).toBeUndefined();
    });

    it('returns undefined for non-matching slug', () => {
      const result = service.resolveBySlug(collections, 'cms', 'invalid');
      expect(result).toBeUndefined();
    });

    it('handles empty plugin slug', () => {
      const systemCollections: Collection[] = [
        {
          slug: 'users',
          shortSlug: 'users',
          pluginSlug: 'system',
          label: 'Users'
        } as unknown as Collection
      ];
      const result = service.resolveBySlug(systemCollections, '', 'users');
      expect(result).toBeDefined();
    });

    it('handles case-insensitive matching', () => {
      const result = service.resolveBySlug(collections, 'CMS', 'PAGES');
      expect(result).toBeDefined();
      expect(result?.slug).toBe('cms-pages');
    });

    it('handles empty collections array', () => {
      const result = service.resolveBySlug([], 'cms', 'pages');
      expect(result).toBeUndefined();
    });
  });

  describe('generatePreviewUrl', () => {
    const collection: Collection = {
      slug: 'cms-posts',
      shortSlug: 'posts',
      pluginSlug: 'cms',
      label: 'Posts'
    } as unknown as Collection;

    it('generates URL with custom permalink', () => {
      const record = { 
        id: 1,
        customPermalink: 'my-custom-page'
      };
      const url = service.generatePreviewUrl('http://example.com', record, collection);
      expect(url).toBe('http://example.com/my-custom-page?preview=1');
    });

    it('handles absolute custom permalink', () => {
      const record = {
        id: 1,
        customPermalink: '/absolute/path'
      };
      const url = service.generatePreviewUrl('http://example.com', record, collection);
      expect(url).toBe('http://example.com/absolute/path?preview=1');
    });

    it('adds prefix to relative custom permalink', () => {
      const record = {
        id: 1,
        customPermalink: 'page'
      };
      const options = { prefix: 'blog' };
      const url = service.generatePreviewUrl('http://example.com', record, collection, options);
      expect(url).toBe('http://example.com/blog/page?preview=1');
    });

    it('does not add prefix to absolute custom permalink', () => {
      const record = {
        id: 1,
        customPermalink: '/absolute'
      };
      const options = { prefix: 'blog' };
      const url = service.generatePreviewUrl('http://example.com', record, collection, options);
      expect(url).toBe('http://example.com/absolute?preview=1');
    });

    it('generates URL from slug using default structure', () => {
      const record = {
        id: 1,
        slug: 'my-post',
        createdAt: new Date('2024-01-15')
      };
      const url = service.generatePreviewUrl('http://example.com', record, collection);
      expect(url).toBe('http://example.com/my-post?preview=1');
    });

    it('supports :slug placeholder', () => {
      const record = {
        id: 1,
        slug: 'hello-world'
      };
      const options = { permalinkStructure: '/posts/:slug' };
      const url = service.generatePreviewUrl('http://example.com', record, collection, options);
      expect(url).toBe('http://example.com/posts/hello-world?preview=1');
    });

    it('supports :year/:month/:day placeholders', () => {
      const record = {
        id: 1,
        slug: 'post',
        createdAt: new Date('2024-03-08')
      };
      const options = { permalinkStructure: '/:year/:month/:day/:slug' };
      const url = service.generatePreviewUrl('http://example.com', record, collection, options);
      expect(url).toBe('http://example.com/2024/03/08/post?preview=1');
    });

    it('supports :id placeholder', () => {
      const record = {
        id: 42,
        slug: 'post'
      };
      const options = { permalinkStructure: '/posts/:id' };
      const url = service.generatePreviewUrl('http://example.com', record, collection, options);
      expect(url).toBe('http://example.com/posts/42?preview=1');
    });

    it('adds prefix to structured URLs', () => {
      const record = {
        id: 1,
        slug: 'post'
      };
      const options = {
        permalinkStructure: '/:slug',
        prefix: 'blog'
      };
      const url = service.generatePreviewUrl('http://example.com', record, collection, options);
      expect(url).toBe('http://example.com/blog/post?preview=1');
    });

    it('cleans up trailing slash from base URL', () => {
      const record = {
        id: 1,
        customPermalink: 'page'
      };
      const url = service.generatePreviewUrl('http://example.com/', record, collection);
      expect(url).toBe('http://example.com/page?preview=1');
    });

    it('returns # for null record', () => {
      const url = service.generatePreviewUrl('http://example.com', null, collection);
      expect(url).toBe('#');
    });

    it('returns # for empty base URL', () => {
      const record = { id: 1, slug: 'post' };
      const url = service.generatePreviewUrl('', record, collection);
      expect(url).toBe('#');
    });

    it('uses id for new records without slug', () => {
      const record = {
        id: 'new',
        createdAt: new Date('2024-01-01')
      };
      const options = { permalinkStructure: '/:slug' };
      const url = service.generatePreviewUrl('http://example.com', record, collection, options);
      expect(url).toBe('http://example.com/new?preview=1');
    });
  });

  describe('toDocs', () => {
    it('returns arrays as-is', () => {
      const docs = [{ id: 1 }, { id: 2 }];
      expect(service.toDocs(docs)).toEqual(docs);
    });

    it('extracts docs property from object', () => {
      const result = {
        docs: [{ id: 1 }, { id: 2 }],
        total: 2
      };
      expect(service.toDocs(result)).toEqual(result.docs);
    });

    it('returns empty array for non-array/non-object', () => {
      expect(service.toDocs(null)).toEqual([]);
      expect(service.toDocs(undefined)).toEqual([]);
      expect(service.toDocs('string')).toEqual([]);
      expect(service.toDocs(123)).toEqual([]);
    });

    it('returns empty array for object without docs', () => {
      expect(service.toDocs({ data: [] })).toEqual([]);
      expect(service.toDocs({})).toEqual([]);
    });

    it('handles nested docs structures', () => {
      const result = {
        data: {
          docs: [{ id: 1 }]
        }
      };
      // Only top-level docs are extracted
      expect(service.toDocs(result)).toEqual([]);
    });
  });

  describe('findByCandidates', () => {
    const mockCollection = {
      findOne: vi.fn(),
      find: vi.fn()
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('finds record by first candidate', async () => {
      const record = { id: 1, slug: 'test' };
      mockCollection.findOne.mockResolvedValue(record);

      const result = await service.findByCandidates(
        mockCollection as any,
        ['test', 'test-alt']
      );

      expect(result).toEqual(record);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ slug: 'test' });
    });

    it('tries multiple fields', async () => {
      mockCollection.findOne
        .mockResolvedValueOnce(null) // slug
        .mockResolvedValueOnce(null) // customPermalink
        .mockResolvedValueOnce({ id: 1, path: '/test' }); // path

      const result = await service.findByCandidates(
        mockCollection as any,
        ['/test']
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(mockCollection.findOne).toHaveBeenCalledTimes(3);
    });

    it('falls back to scan when direct lookup fails', async () => {
      mockCollection.findOne.mockResolvedValue(null);
      mockCollection.find.mockResolvedValue([
        { id: 1, slug: 'exact-match' },
        { id: 2, slug: 'other' }
      ]);

      const result = await service.findByCandidates(
        mockCollection as any,
        ['exact-match']
      );

      expect(result).toBeDefined();
      expect(result?.slug).toBe('exact-match');
    });

    it('returns null when no match found', async () => {
      mockCollection.findOne.mockResolvedValue(null);
      mockCollection.find.mockResolvedValue([]);

      const result = await service.findByCandidates(
        mockCollection as any,
        ['nonexistent']
      );

      expect(result).toBeNull();
    });

    it('normalizes candidates before searching', async () => {
      mockCollection.findOne.mockResolvedValue({ id: 1 });

      await service.findByCandidates(
        mockCollection as any,
        ['  Test  ', 'TEST']
      );

      // Should normalize to lowercase "test" and only search once due to deduplication
      expect(mockCollection.findOne).toHaveBeenCalledWith({ slug: 'Test' });
    });

    it('removes duplicate candidates', async () => {
      mockCollection.findOne.mockResolvedValue({ id: 1 });

      await service.findByCandidates(
        mockCollection as any,
        ['test', 'test', 'Test']
      );

      // Should only try once due to deduplication
      expect(mockCollection.findOne).toHaveBeenCalledTimes(1);
    });

    it('returns null for empty candidates', async () => {
      const result = await service.findByCandidates(
        mockCollection as any,
        []
      );

      expect(result).toBeNull();
      expect(mockCollection.findOne).not.toHaveBeenCalled();
    });

    it('uses custom fields option', async () => {
      mockCollection.findOne.mockResolvedValue({ id: 1 });

      await service.findByCandidates(
        mockCollection as any,
        ['test'],
        { fields: ['title', 'name'] }
      );

      expect(mockCollection.findOne).toHaveBeenCalledWith({ title: 'test' });
    });

    it('respects scanLimit option', async () => {
      mockCollection.findOne.mockResolvedValue(null);
      mockCollection.find.mockResolvedValue([]);

      await service.findByCandidates(
        mockCollection as any,
        ['test'],
        { scanLimit: 500 }
      );

      expect(mockCollection.find).toHaveBeenCalledWith({ limit: 500 });
    });
  });

  describe('findAndUpsert', () => {
    const mockCollection = {
      findOne: vi.fn(),
      find: vi.fn(),
      insert: vi.fn(),
      update: vi.fn()
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('updates existing record', async () => {
      const existing = { id: 1, slug: 'test' };
      const updated = { ...existing, title: 'Updated' };
      
      mockCollection.findOne.mockResolvedValue(existing);
      mockCollection.update.mockResolvedValue(updated);

      const result = await service.findAndUpsert(
        mockCollection as any,
        ['test'],
        { title: 'Updated' }
      );

      expect(result.created).toBe(false);
      expect(result.record).toEqual(updated);
      expect(mockCollection.update).toHaveBeenCalled();
      expect(mockCollection.insert).not.toHaveBeenCalled();
    });

    it('inserts new record when not found', async () => {
      const newRecord = { id: 1, slug: 'new-item' };
      
      mockCollection.findOne.mockResolvedValue(null);
      mockCollection.find.mockResolvedValue([]);
      mockCollection.insert.mockResolvedValue(newRecord);

      const result = await service.findAndUpsert(
        mockCollection as any,
        ['new-item'],
        { slug: 'new-item', title: 'New' }
      );

      expect(result.created).toBe(true);
      expect(result.record).toEqual(newRecord);
      expect(mockCollection.insert).toHaveBeenCalled();
    });

    it('retries as update on insert race condition', async () => {
      const existing = { id: 1, slug: 'test' };
      const updated = { ...existing, title: 'Updated' };

      // First lookup: not found
      mockCollection.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing); // Retry lookup
      mockCollection.find.mockResolvedValue([]);
      
      // Insert fails (race condition)
      mockCollection.insert.mockRejectedValue(new Error('Duplicate key'));
      mockCollection.update.mockResolvedValue(updated);

      const result = await service.findAndUpsert(
        mockCollection as any,
        ['test'],
        { title: 'Updated' }
      );

      expect(result.created).toBe(false);
      expect(result.record).toEqual(updated);
      expect(mockCollection.update).toHaveBeenCalled();
    });

    it('uses custom idField option', async () => {
      const existing = { uid: 'abc123', slug: 'test' };
      mockCollection.findOne.mockResolvedValue(existing);
      mockCollection.update.mockResolvedValue(existing);

      await service.findAndUpsert(
        mockCollection as any,
        ['test'],
        { title: 'Updated' },
        { idField: 'uid' }
      );

      expect(mockCollection.update).toHaveBeenCalledWith(
        { uid: 'abc123' },
        { title: 'Updated' }
      );
    });

    it('uses custom updateWhere function', async () => {
      const existing = { id: 1, slug: 'test', version: 5 };
      mockCollection.findOne.mockResolvedValue(existing);
      mockCollection.update.mockResolvedValue(existing);

      await service.findAndUpsert(
        mockCollection as any,
        ['test'],
        { title: 'Updated' },
        {
          updateWhere: (record) => ({
            id: record.id,
            version: record.version
          })
        }
      );

      expect(mockCollection.update).toHaveBeenCalledWith(
        { id: 1, version: 5 },
        { title: 'Updated' }
      );
    });
  });
});
