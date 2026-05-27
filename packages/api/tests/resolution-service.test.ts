jest.mock('@fromcode119/core', () => ({
  CoreServices: {
    getInstance: jest.fn(),
    reset: jest.fn(),
  },
  CoercionUtils: {
    toBoolean: jest.fn((value: unknown, fallback = false) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number' && Number.isFinite(value)) return value > 0;
      const normalized = String(value ?? '').trim().toLowerCase();
      if (['true', '1', '1.0', 'yes', 'on', 'enabled', 'active'].includes(normalized)) return true;
      if (['false', '0', '0.0', 'no', 'off', 'disabled', 'inactive'].includes(normalized)) return false;
      return fallback;
    }),
  },
  SystemConstants: {
    TABLE: {
      META: 'meta',
    },
  },
}));

import { CoreServices } from '@fromcode119/core';
import { ResolutionService } from '../src/services/resolution-service';

describe('ResolutionService default page contract routing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    CoreServices.reset();
  });

  it('resolves singleton aliases through the contract canonical page slug', async () => {
    const restController = {
      find: jest.fn().mockImplementation((_collection: any, options: any) => {
        if (options?.query?.slug === 'numerology') {
          return Promise.resolve({ docs: [] });
        }

        if (options?.query?.slug === 'shop') {
          return Promise.resolve({ docs: [{ id: 1, slug: 'shop' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: jest.fn().mockResolvedValue([]) },
      getPlugins: jest.fn().mockReturnValue([{ state: 'active', manifest: { slug: 'ecommerce' } }]),
      registeredCollections: new Map([
        [
          'pages',
          {
            pluginSlug: 'system',
            collection: {
              slug: 'pages',
              shortSlug: 'pages',
              fields: [{ name: 'slug' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: jest.fn().mockResolvedValue([]),
    };

    jest.spyOn(CoreServices, 'getInstance').mockReturnValue({
      defaultPageContractResolution: {
        resolveAll: jest.fn().mockReturnValue([
          {
            install: true,
            status: 'ready',
            materializationMode: 'singleton-document',
            effectiveSlug: '/shop',
            effectiveAliases: ['/numerology'],
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/numerology', {});

    expect(result).toEqual({
      type: 'pages',
      plugin: 'system',
      doc: { id: 1, slug: 'shop' },
    });
    expect(restController.find).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'pages' }),
      expect.objectContaining({
        query: expect.objectContaining({ slug: 'shop', limit: 1, preview: '0' }),
      }),
    );
  });

  it('skips disabled singleton contracts during contract-aware resolution', async () => {
    const restController = {
      find: jest.fn(),
    };
    const manager: any = {
      db: { find: jest.fn().mockResolvedValue([]) },
      getPlugins: jest.fn().mockReturnValue([{ state: 'active', manifest: { slug: 'privacy' } }]),
      registeredCollections: new Map([
        [
          'pages',
          {
            pluginSlug: 'system',
            collection: {
              slug: 'pages',
              shortSlug: 'pages',
              fields: [],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: jest.fn().mockResolvedValue([]),
    };

    jest.spyOn(CoreServices, 'getInstance').mockReturnValue({
      defaultPageContractResolution: {
        resolveAll: jest.fn().mockReturnValue([
          {
            install: false,
            status: 'skipped',
            materializationMode: 'singleton-document',
            effectiveSlug: '/privacy-policy',
            effectiveAliases: [],
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);

    await expect(service.resolveSlug('/privacy-policy', {})).resolves.toBeNull();
    expect(restController.find).not.toHaveBeenCalled();
  });

  it('resolves parameterized detail families through the contract record collection', async () => {
    const restController = {
      find: jest.fn().mockImplementation((collection: any, options: any) => {
        if (collection.slug === 'ecommerce-products') {
          return Promise.resolve({ docs: [{ id: 7, slug: 'lyubov', name: 'Love Box' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: jest.fn().mockResolvedValue([]) },
      getPlugins: jest.fn().mockReturnValue([{ state: 'active', manifest: { slug: 'ecommerce' } }]),
      registeredCollections: new Map([
        [
          'catalog',
          {
            pluginSlug: 'ecommerce',
            collection: {
              slug: 'ecommerce-products',
              shortSlug: 'catalog',
              fields: [{ name: 'slug' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: jest.fn().mockResolvedValue([]),
    };

    jest.spyOn(CoreServices, 'getInstance').mockReturnValue({
      defaultPageContractResolution: {
        resolveAll: jest.fn().mockReturnValue([
          {
            install: true,
            status: 'ready',
            materializationMode: 'singleton-document',
            effectiveSlug: '/shop/:slug',
            effectiveAliases: ['/cosmic-box/:slug'],
            recordCollection: 'catalog',
            pluginSlug: 'ecommerce',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/shop/lyubov', {});

    expect(result).toEqual({
      type: 'catalog',
      plugin: 'ecommerce',
      doc: { id: 7, slug: 'lyubov', name: 'Love Box' },
    });
  });

  it('prefers exact permalink pages before contract detail fallback', async () => {
    const restController = {
      find: jest.fn().mockImplementation((collection: any, options: any) => {
        if (collection.slug === 'pages') {
          if (options?.query?.customPermalink === '/cosmic-box/lyubov') {
            return Promise.resolve({ docs: [{ id: 18, slug: 'cosmic-box/lyubov', customPermalink: '/cosmic-box/lyubov' }] });
          }
        }

        if (collection.slug === 'ecommerce-products') {
          return Promise.resolve({ docs: [{ id: 7, slug: 'lyubov', name: 'Love Box' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: jest.fn().mockResolvedValue([]) },
      getPlugins: jest.fn().mockReturnValue([{ state: 'active', manifest: { slug: 'ecommerce' } }]),
      registeredCollections: new Map([
        [
          'pages',
          {
            pluginSlug: 'system',
            collection: {
              slug: 'pages',
              shortSlug: 'pages',
              fields: [{ name: 'slug' }, { name: 'customPermalink' }],
            },
          },
        ],
        [
          'catalog',
          {
            pluginSlug: 'ecommerce',
            collection: {
              slug: 'ecommerce-products',
              shortSlug: 'catalog',
              fields: [{ name: 'slug' }, { name: 'page' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: jest.fn().mockResolvedValue([]),
    };

    jest.spyOn(CoreServices, 'getInstance').mockReturnValue({
      defaultPageContractResolution: {
        resolveAll: jest.fn().mockReturnValue([
          {
            install: true,
            status: 'ready',
            materializationMode: 'singleton-document',
            effectiveSlug: '/shop/:slug',
            effectiveAliases: ['/cosmic-box/:slug'],
            recordCollection: 'catalog',
            pluginSlug: 'ecommerce',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/cosmic-box/lyubov', {});

    expect(result).toEqual({
      type: 'pages',
      plugin: 'system',
      doc: { id: 18, slug: 'cosmic-box/lyubov', customPermalink: '/cosmic-box/lyubov' },
    });
  });

  it('returns the CMS page for /shop when an exact page permalink exists and preserves safe contract presentation', async () => {
    const restController = {
      find: jest.fn().mockImplementation((collection: any, options: any) => {
        if (collection.slug === 'pages' && options?.query?.customPermalink === '/shop') {
          return Promise.resolve({ docs: [{ id: 9, slug: 'shop', customPermalink: '/shop' }] });
        }

        if (collection.slug === 'synthetic-catalog') {
          return Promise.resolve({ docs: [{ id: 77, slug: 'shop', title: 'Synthetic Catalog' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: jest.fn().mockResolvedValue([]) },
      getPlugins: jest.fn().mockReturnValue([{ state: 'active', manifest: { slug: 'catalog-module' } }]),
      registeredCollections: new Map([
        [
          'pages',
          {
            pluginSlug: 'system',
            collection: {
              slug: 'pages',
              shortSlug: 'pages',
              fields: [{ name: 'slug' }, { name: 'customPermalink' }],
            },
          },
        ],
        [
          'catalog',
          {
            pluginSlug: 'catalog-module',
            collection: {
              slug: 'synthetic-catalog',
              shortSlug: 'catalog',
              fields: [{ name: 'slug' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: jest.fn().mockResolvedValue([]),
    };

    jest.spyOn(CoreServices, 'getInstance').mockReturnValue({
      defaultPageContractResolution: {
        resolveAll: jest.fn().mockReturnValue([
          {
            install: true,
            status: 'ready',
            materializationMode: 'singleton-document',
            effectiveSlug: '/shop',
            effectiveAliases: [],
            effectiveTitle: 'Catalog Contract Page',
            effectiveThemeLayout: 'CatalogLayout',
            recordCollection: 'catalog',
            pluginSlug: 'catalog-module',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/shop', {});

    expect(result).toEqual({
      type: 'pages',
      plugin: 'system',
      doc: {
        id: 9,
        slug: 'shop',
        customPermalink: '/shop',
        title: 'Catalog Contract Page',
        themeLayout: 'CatalogLayout',
      },
    });
  });

  it('falls back to the enabled contract for /shop when no exact CMS page exists', async () => {
    const restController = {
      find: jest.fn().mockImplementation((collection: any, options: any) => {
        if (collection.slug === 'pages' && options?.query?.customPermalink === '/shop') {
          return Promise.resolve({ docs: [] });
        }

        if (collection.slug === 'pages' && options?.query?.slug === 'shop') {
          return Promise.resolve({ docs: [{ id: 42, slug: 'shop', title: 'Contract Catalog Page' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: jest.fn().mockResolvedValue([]) },
      getPlugins: jest.fn().mockReturnValue([{ state: 'active', manifest: { slug: 'catalog-module' } }]),
      registeredCollections: new Map([
        [
          'pages',
          {
            pluginSlug: 'system',
            collection: {
              slug: 'pages',
              shortSlug: 'pages',
              fields: [{ name: 'slug' }, { name: 'customPermalink' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: jest.fn().mockResolvedValue([]),
    };

    jest.spyOn(CoreServices, 'getInstance').mockReturnValue({
      defaultPageContractResolution: {
        resolveAll: jest.fn().mockReturnValue([
          {
            install: true,
            status: 'ready',
            materializationMode: 'singleton-document',
            effectiveSlug: '/shop',
            effectiveAliases: [],
            pluginSlug: 'catalog-module',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/shop', {});

    expect(result).toEqual({
      type: 'pages',
      plugin: 'system',
      doc: { id: 42, slug: 'shop', title: 'Contract Catalog Page' },
    });
    expect(restController.find).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'pages' }),
      expect.objectContaining({
        query: expect.objectContaining({ slug: 'shop', limit: 1, preview: '0' }),
      }),
    );
  });

  it('does not fall back for /shop when the matching contract is disabled', async () => {
    const restController = {
      find: jest.fn().mockImplementation((collection: any, options: any) => {
        if (collection.slug === 'pages' && options?.query?.customPermalink === '/shop') {
          return Promise.resolve({ docs: [] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: jest.fn().mockResolvedValue([]) },
      getPlugins: jest.fn().mockReturnValue([{ state: 'active', manifest: { slug: 'catalog-module' } }]),
      registeredCollections: new Map([
        [
          'pages',
          {
            pluginSlug: 'system',
            collection: {
              slug: 'pages',
              shortSlug: 'pages',
              fields: [{ name: 'slug' }, { name: 'customPermalink' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: jest.fn().mockResolvedValue([]),
    };

    jest.spyOn(CoreServices, 'getInstance').mockReturnValue({
      defaultPageContractResolution: {
        resolveAll: jest.fn().mockReturnValue([
          {
            install: false,
            status: 'skipped',
            materializationMode: 'singleton-document',
            effectiveSlug: '/shop',
            effectiveAliases: [],
            pluginSlug: 'catalog-module',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);

    await expect(service.resolveSlug('/shop', {})).resolves.toBeNull();
  });

  it('does not resolve detail contracts for records with disabled permalinks', async () => {
    const restController = {
      find: jest.fn().mockImplementation((collection: any) => {
        if (collection.slug === 'ecommerce-products') {
          return Promise.resolve({ docs: [{ id: 7, slug: 'lyubov', disablePermalink: '1.0' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue({ id: 7, disablePermalink: '1.0' }),
      },
      getPlugins: jest.fn().mockReturnValue([{ state: 'active', manifest: { slug: 'ecommerce' } }]),
      registeredCollections: new Map([
        [
          'catalog',
          {
            pluginSlug: 'ecommerce',
            collection: {
              slug: 'ecommerce-products',
              shortSlug: 'catalog',
              fields: [{ name: 'slug' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: jest.fn().mockResolvedValue([]),
    };

    jest.spyOn(CoreServices, 'getInstance').mockReturnValue({
      defaultPageContractResolution: {
        resolveAll: jest.fn().mockReturnValue([
          {
            install: true,
            status: 'ready',
            materializationMode: 'singleton-document',
            effectiveSlug: '/shop/:slug',
            effectiveAliases: [],
            recordCollection: 'catalog',
            pluginSlug: 'ecommerce',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/shop/lyubov', {});

    expect(result).toBeNull();
  });

  it('does not let path-only analytics records hijack public URLs', async () => {
    const restController = {
      find: jest.fn().mockImplementation((collection: any, options: any) => {
        if (collection.slug === 'pages' && options?.query?.slug === 'courses/21-dni-kurs-za-finansovo-izobilie') {
          return Promise.resolve({ docs: [] });
        }

        if (collection.slug === 'lms-courses' && options?.query?.slug === '21-dni-kurs-za-finansovo-izobilie') {
          return Promise.resolve({ docs: [{ id: 21, slug: '21-dni-kurs-za-finansovo-izobilie', title: '21-дневен курс' }] });
        }

        return Promise.resolve({ docs: [] });
      }),
    };
    const manager: any = {
      db: { find: jest.fn().mockResolvedValue([]) },
      getPlugins: jest.fn().mockReturnValue([
        { state: 'active', manifest: { slug: 'analytics' } },
        { state: 'active', manifest: { slug: 'lms' } },
      ]),
      registeredCollections: new Map([
        [
          'analytics-events',
          {
            pluginSlug: 'analytics',
            collection: {
              slug: 'analytics-events',
              shortSlug: 'site-events',
              fields: [{ name: 'path' }],
            },
          },
        ],
        [
          'courses',
          {
            pluginSlug: 'lms',
            collection: {
              slug: 'lms-courses',
              shortSlug: 'courses',
              fields: [{ name: 'slug' }],
            },
          },
        ],
      ]),
    };
    const themeManager: any = {
      getActiveThemeDefaultPageContractOverrides: jest.fn().mockResolvedValue([]),
    };

    jest.spyOn(CoreServices, 'getInstance').mockReturnValue({
      defaultPageContractResolution: {
        resolveAll: jest.fn().mockReturnValue([
          {
            install: true,
            status: 'ready',
            materializationMode: 'singleton-document',
            effectiveSlug: '/courses/:slug',
            effectiveAliases: [],
            recordCollection: 'courses',
            pluginSlug: 'lms',
          },
        ]),
      },
    } as any);

    const service = new ResolutionService(manager, themeManager, restController as any);
    const result = await service.resolveSlug('/courses/21-dni-kurs-za-finansovo-izobilie', {});

    expect(result).toEqual({
      type: 'courses',
      plugin: 'lms',
      doc: { id: 21, slug: '21-dni-kurs-za-finansovo-izobilie', title: '21-дневен курс' },
    });
    expect(restController.find).not.toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'analytics-events' }),
      expect.objectContaining({ query: expect.objectContaining({ path: '/courses/21-dni-kurs-za-finansovo-izobilie' }) }),
    );
  });
});