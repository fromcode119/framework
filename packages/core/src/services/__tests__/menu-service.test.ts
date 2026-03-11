import { describe, it, expect, beforeEach } from 'vitest';
import { MenuService } from '../menu-service';

describe('MenuService', () => {
  let service: MenuService;

  beforeEach(() => {
    service = new MenuService();
  });

  describe('normalizeGroupKey', () => {
    it('trims and lowercases input', () => {
      expect(service.normalizeGroupKey('  CONTENT  ')).toBe('content');
      expect(service.normalizeGroupKey('System')).toBe('system');
    });

    it('uses fallback for empty strings', () => {
      expect(service.normalizeGroupKey('')).toBe('management');
      expect(service.normalizeGroupKey('   ')).toBe('management');
    });

    it('uses custom fallback', () => {
      expect(service.normalizeGroupKey('', 'custom')).toBe('custom');
      expect(service.normalizeGroupKey(undefined, 'default')).toBe('default');
    });

    it('preserves valid keys', () => {
      expect(service.normalizeGroupKey('content')).toBe('content');
      expect(service.normalizeGroupKey('system')).toBe('system');
    });

    it('handles undefined input', () => {
      expect(service.normalizeGroupKey(undefined)).toBe('management');
      expect(service.normalizeGroupKey(undefined, 'admin')).toBe('admin');
    });
  });

  describe('normalizePath', () => {
    it('trims whitespace', () => {
      expect(service.normalizePath('  /path  ')).toBe('/path');
      expect(service.normalizePath('\t/path\n')).toBe('/path');
    });

    it('removes trailing slashes', () => {
      expect(service.normalizePath('/path/')).toBe('/path');
      expect(service.normalizePath('/path///')).toBe('/path');
    });

    it('preserves root path', () => {
      expect(service.normalizePath('/')).toBe('/');
    });

    it('handles multiple slashes', () => {
      expect(service.normalizePath('///')).toBe(''); // empty after trim
    });

    it('converts to lowercase', () => {
      expect(service.normalizePath('/Content')).toBe('/content');
      expect(service.normalizePath('/ADMIN/SETTINGS')).toBe('/admin/settings');
    });

    it('handles empty strings', () => {
      expect(service.normalizePath('')).toBe('');
      expect(service.normalizePath('   ')).toBe('');
    });

    it('handles undefined and null', () => {
      expect(service.normalizePath(undefined)).toBe('');
      expect(service.normalizePath(null)).toBe('');
    });

    it('handles non-string values', () => {
      expect(service.normalizePath(123 as any)).toBe('123');
      expect(service.normalizePath(true as any)).toBe('true');
    });

    it('normalizes complex paths', () => {
      expect(service.normalizePath('/Admin/Settings/')).toBe('/admin/settings');
      expect(service.normalizePath('  /CONTENT/Posts//  ')).toBe('/content/posts');
    });
  });

  describe('getNestedPaths', () => {
    it('collects single item path', () => {
      const item = { path: '/admin' };
      expect(service.getNestedPaths(item)).toEqual(['/admin']);
    });

    it('collects nested children paths', () => {
      const item = {
        path: '/admin',
        children: [
          { path: '/admin/users' },
          { path: '/admin/settings' }
        ]
      };
      const result = service.getNestedPaths(item);
      expect(result).toContain('/admin');
      expect(result).toContain('/admin/users');
      expect(result).toContain('/admin/settings');
      expect(result.length).toBe(3);
    });

    it('collects deeply nested paths', () => {
      const item = {
        path: '/admin',
        children: [
          {
            path: '/admin/users',
            children: [
              { path: '/admin/users/roles' },
              { path: '/admin/users/permissions' }
            ]
          }
        ]
      };
      const result = service.getNestedPaths(item);
      expect(result).toContain('/admin');
      expect(result).toContain('/admin/users');
      expect(result).toContain('/admin/users/roles');
      expect(result).toContain('/admin/users/permissions');
      expect(result.length).toBe(4);
    });

    it('handles items without paths', () => {
      const item = {
        children: [
          { path: '/child1' },
          { path: '/child2' }
        ]
      };
      const result = service.getNestedPaths(item);
      expect(result).toEqual(['/child1', '/child2']);
    });

    it('handles empty children arrays', () => {
      const item = {
        path: '/admin',
        children: []
      };
      expect(service.getNestedPaths(item)).toEqual(['/admin']);
    });

    it('handles null and undefined children', () => {
      const item = { path: '/admin', children: null };
      expect(service.getNestedPaths(item)).toEqual(['/admin']);
    });

    it('handles empty path strings', () => {
      const item = {
        path: '',
        children: [
          { path: '/child' }
        ]
      };
      expect(service.getNestedPaths(item)).toEqual(['/child']);
    });

    it('handles invalid items', () => {
      expect(service.getNestedPaths(null)).toEqual([]);
      expect(service.getNestedPaths(undefined)).toEqual([]);
      expect(service.getNestedPaths('string' as any)).toEqual([]);
    });

    it('handles mixed valid and invalid children', () => {
      const item = {
        path: '/parent',
        children: [
          { path: '/child1' },
          null,
          { path: '/child2' },
          undefined,
          { path: '' }
        ]
      };
      const result = service.getNestedPaths(item);
      expect(result).toContain('/parent');
      expect(result).toContain('/child1');
      expect(result).toContain('/child2');
      expect(result.length).toBe(3);
    });
  });

  describe('deduplicate', () => {
    it('removes duplicate top-level paths', () => {
      const items = [
        { path: '/admin' },
        { path: '/content' },
        { path: '/admin' } // duplicate
      ];
      const result = service.deduplicate(items);
      expect(result.length).toBe(2);
      expect(result.map(i => i.path)).toEqual(['/admin', '/content']);
    });

    it('removes duplicate child paths', () => {
      const items = [
        {
          path: '/admin',
          children: [
            { path: '/admin/users' },
            { path: '/admin/settings' },
            { path: '/admin/users' } // duplicate
          ]
        }
      ];
      const result = service.deduplicate(items);
      expect(result[0].children.length).toBe(2);
      expect(result[0].children.map((c: any) => c.path)).toEqual([
        '/admin/users',
        '/admin/settings'
      ]);
    });

    it('removes top-level items that exist as children', () => {
      const items = [
        {
          path: '/admin',
          children: [
            { path: '/admin/users' },
            { path: '/admin/settings' }
          ]
        },
        { path: '/admin/users' }, // duplicate of child
        { path: '/content' }
      ];
      const result = service.deduplicate(items);
      expect(result.length).toBe(2);
      expect(result.map(i => i.path)).toEqual(['/admin', '/content']);
    });

    it('preserves items with children even if path is duplicate', () => {
      const items = [
        {
          path: '/admin',
          children: [
            { path: '/admin/users' }
          ]
        },
        { path: '/admin' } // duplicate
      ];
      const result = service.deduplicate(items);
      expect(result.length).toBe(1);
      // Item with children should be preserved
      expect(result[0].children).toBeDefined();
      expect(result[0].children.length).toBe(1);
    });

    it('handles empty arrays', () => {
      expect(service.deduplicate([])).toEqual([]);
    });

    it('handles items without paths', () => {
      const items = [
        { name: 'Item 1' },
        { name: 'Item 2' }
      ];
      const result = service.deduplicate(items);
      expect(result.length).toBe(2);
    });

    it('normalizes paths before de-duplication', () => {
      const items = [
        { path: '/Admin' },
        { path: '/ADMIN/' },
        { path: '/admin' }
      ];
      const result = service.deduplicate(items);
      expect(result.length).toBe(1);
      expect(result[0].path).toBe('/Admin'); // preserves first
    });

    it('handles complex nested deduplication', () => {
      const items = [
        {
          path: '/admin',
          children: [
            { path: '/admin/users' },
            { path: '/admin/users' }, // duplicate child
            { path: '/admin/settings' }
          ]
        },
        { path: '/admin/users' }, // duplicate of child
        { path: '/content' },
        { path: '/content' } // duplicate top-level
      ];
      const result = service.deduplicate(items);
      expect(result.length).toBe(2);
      expect(result[0].children.length).toBe(2);
      expect(result.map(i => i.path)).toEqual(['/admin', '/content']);
    });

    it('preserves item properties', () => {
      const items = [
        { path: '/admin', label: 'Admin', icon: 'settings' },
        { path: '/content', label: 'Content', icon: 'file' }
      ];
      const result = service.deduplicate(items);
      expect(result[0]).toMatchObject({
        path: '/admin',
        label: 'Admin',
        icon: 'settings'
      });
    });

    it('handles null and undefined children', () => {
      const items = [
        { path: '/admin', children: null },
        { path: '/content', children: undefined },
        { path: '/settings' }
      ];
      const result = service.deduplicate(items);
      expect(result.length).toBe(3);
    });
  });
});
