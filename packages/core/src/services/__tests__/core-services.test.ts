import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CoreServices } from '../core-services';
import { LocalizationService } from '../localization-service';
import { ContentService } from '../content-service';
import { MenuService } from '../menu-service';
import { CollectionService } from '../collection-service';

describe('CoreServices', () => {
  afterEach(() => {
    // Reset singleton between tests
    CoreServices.reset();
  });

  describe('Singleton Pattern', () => {
    it('returns same instance on multiple calls', () => {
      const instance1 = CoreServices.getInstance();
      const instance2 = CoreServices.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('resets singleton with reset()', () => {
      const instance1 = CoreServices.getInstance();
      CoreServices.reset();
      const instance2 = CoreServices.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Service Lazy Loading', () => {
    it('creates localization service on first access', () => {
      const services = CoreServices.getInstance();
      const localization = services.localization;
      expect(localization).toBeInstanceOf(LocalizationService);
    });

    it('creates content service on first access', () => {
      const services = CoreServices.getInstance();
      const content = services.content;
      expect(content).toBeInstanceOf(ContentService);
    });

    it('creates menu service on first access', () => {
      const services = CoreServices.getInstance();
      const menu = services.menu;
      expect(menu).toBeInstanceOf(MenuService);
    });

    it('creates collection service on first access', () => {
      const services = CoreServices.getInstance();
      const collection = services.collection;
      expect(collection).toBeInstanceOf(CollectionService);
    });

    it('reuses service instances', () => {
      const services = CoreServices.getInstance();
      const loc1 = services.localization;
      const loc2 = services.localization;
      expect(loc1).toBe(loc2);
    });

    it('creates new services after reset', () => {
      const services1 = CoreServices.getInstance();
      const loc1 = services1.localization;
      
      CoreServices.reset();
      
      const services2 = CoreServices.getInstance();
      const loc2 = services2.localization;
      
      expect(loc1).not.toBe(loc2);
    });
  });

  describe('Service Integration', () => {
    let services: CoreServices;

    beforeEach(() => {
      services = CoreServices.getInstance();
    });

    it('localization service methods work', () => {
      const locale = services.localization.normalizeLocale('en_US');
      expect(locale).toBe('en-us');
    });

    it('content service methods work', () => {
      const text = services.content.extractText('Hello World');
      expect(text).toBe('Hello World');
    });

    it('menu service methods work', () => {
      const path = services.menu.normalizePath('/Admin/');
      expect(path).toBe('/admin');
    });

    it('collection service methods work', () => {
      const docs = services.collection.toDocs([{ id: 1 }]);
      expect(docs).toEqual([{ id: 1 }]);
    });

    it('all services accessible from single instance', () => {
      expect(services.localization).toBeDefined();
      expect(services.content).toBeDefined();
      expect(services.menu).toBeDefined();
      expect(services.collection).toBeDefined();
    });
  });

  describe('Service Name Reporting', () => {
    it('localization service has correct name', () => {
      const services = CoreServices.getInstance();
      expect(services.localization.serviceName).toBe('LocalizationService');
    });

    it('content service has correct name', () => {
      const services = CoreServices.getInstance();
      expect(services.content.serviceName).toBe('ContentService');
    });

    it('menu service has correct name', () => {
      const services = CoreServices.getInstance();
      expect(services.menu.serviceName).toBe('MenuService');
    });

    it('collection service has correct name', () => {
      const services = CoreServices.getInstance();
      expect(services.collection.serviceName).toBe('CollectionService');
    });
  });

  describe('Real-World Usage Patterns', () => {
    it('handles locale normalization and resolution', () => {
      const services = CoreServices.getInstance();
      const normalized = services.localization.normalizeLocale('pt_BR');
      const text = services.localization.resolveText(
        { 'pt-br': 'Olá', en: 'Hello' },
        normalized
      );
      expect(text).toBe('Olá');
    });

    it('handles content extraction and string collection', () => {
      const services = CoreServices.getInstance();
      const blocks = [
        { content: 'First paragraph' },
        { text: 'Second paragraph' }
      ];
      const extracted = services.content.extractText(blocks);
      const strings = services.content.collectStrings({ data: extracted });
      
      expect(extracted).toContain('First paragraph');
      expect(strings).toContain('First paragraph Second paragraph');
    });

    it('handles menu path normalization and deduplication', () => {
      const services = CoreServices.getInstance();
      const items = [
        { path: '/Admin/' },
        { path: '/ADMIN' },
        { path: '/content/' }
      ];
      const normalized = items.map(item => ({
        ...item,
        path: services.menu.normalizePath(item.path)
      }));
      const deduplicated = services.menu.deduplicate(normalized);
      
      expect(deduplicated.length).toBe(2);
    });

    it('handles collection URL generation', () => {
      const services = CoreServices.getInstance();
      const collection: any = {
        slug: 'cms-posts',
        shortSlug: 'posts',
        pluginSlug: 'cms'
      };
      const record = {
        id: 1,
        slug: 'hello-world',
        createdAt: new Date('2024-03-08')
      };
      
      const url = services.collection.generatePreviewUrl(
        'https://example.com',
        record,
        collection,
        { permalinkStructure: '/blog/:slug' }
      );
      
      expect(url).toBe('https://example.com/blog/hello-world?preview=1');
    });
  });

  describe('Memory Management', () => {
    it('does not leak services after reset', () => {
      const services1 = CoreServices.getInstance();
      const loc1 = services1.localization;
      const content1 = services1.content;
      const menu1 = services1.menu;
      const collection1 = services1.collection;
      
      CoreServices.reset();
      
      const services2 = CoreServices.getInstance();
      const loc2 = services2.localization;
      const content2 = services2.content;
      const menu2 = services2.menu;
      const collection2 = services2.collection;
      
      // All services should be different instances
      expect(loc1).not.toBe(loc2);
      expect(content1).not.toBe(content2);
      expect(menu1).not.toBe(menu2);
      expect(collection1).not.toBe(collection2);
    });

    it('creates services independently', () => {
      const services = CoreServices.getInstance();
      
      // Access services in different order
      const collection = services.collection;
      const localization = services.localization;
      const menu = services.menu;
      const content = services.content;
      
      // All should be valid
      expect(collection).toBeInstanceOf(CollectionService);
      expect(localization).toBeInstanceOf(LocalizationService);
      expect(menu).toBeInstanceOf(MenuService);
      expect(content).toBeInstanceOf(ContentService);
    });
  });
});
