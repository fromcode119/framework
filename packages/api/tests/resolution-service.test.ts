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
});