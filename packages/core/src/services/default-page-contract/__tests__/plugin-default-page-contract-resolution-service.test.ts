import { beforeEach, describe, expect, it } from 'vitest';
import type {
  PluginDefaultPageContractRegistration,
  PluginDefaultPageContractResolutionInput,
} from '../../../types';
import { PluginDefaultPageContractRegistryService } from '../plugin-default-page-contract-registry-service';
import { PluginDefaultPageContractResolutionService } from '../plugin-default-page-contract-resolution-service';

describe('PluginDefaultPageContractResolutionService', () => {
  let registry: PluginDefaultPageContractRegistryService;
  let service: PluginDefaultPageContractResolutionService;

  beforeEach(() => {
    registry = new PluginDefaultPageContractRegistryService();
    service = new PluginDefaultPageContractResolutionService(registry);
  });

  it('returns declaration defaults unchanged when no overrides or site state are provided', () => {
    registerContracts(registry, [
      {
        namespace: 'org.fromcode',
        pluginSlug: 'forms',
        contracts: [
          {
            key: 'contact-page',
            kind: 'form-page',
            defaultSlug: '/contact',
            capability: 'contact-form',
            recipe: 'forms.contact-page',
            materializationMode: 'singleton-document',
            dependencies: ['navigation'],
            adoptionHints: ['/contact'],
            aliases: ['/reach-us'],
            required: true,
          },
        ],
      },
    ]);

    expect(service.resolveAll()).toEqual([
      expect.objectContaining({
        canonicalKey: 'org.fromcode:forms:contact-page',
        effectiveSlug: '/contact',
        effectiveAliases: ['/reach-us'],
        effectiveRecipe: 'forms.contact-page',
        effectiveTitle: undefined,
        effectiveThemeLayout: undefined,
        install: true,
        prerequisiteReady: true,
        status: 'ready',
        reasons: [],
        sources: expect.objectContaining({
          effectiveSlug: 'declaration',
          effectiveAliases: 'declaration',
          effectiveRecipe: 'declaration',
          install: 'declaration',
          status: 'declaration',
        }),
      }),
    ]);
  });

  it('applies theme override precedence for presentation and install fields', () => {
    registerStoreIndex(registry);

    const [resolved] = service.resolveAll({
      overrides: [
        {
          contract: {
            namespace: 'org.fromcode',
            pluginSlug: 'ecommerce',
            key: 'store-index',
          },
          slug: '/cosmic-box',
          aliases: ['/shop', '/catalog'],
          title: 'Catalog',
          themeLayout: 'StoreLayout',
          recipe: 'theme.store-index',
          install: false,
        },
      ],
    });

    expect(resolved).toEqual(
      expect.objectContaining({
        effectiveSlug: '/cosmic-box',
        effectiveAliases: ['/shop', '/catalog'],
        effectiveRecipe: 'theme.store-index',
        effectiveTitle: 'Catalog',
        effectiveThemeLayout: 'StoreLayout',
        install: false,
        status: 'skipped',
        reasons: ['install-disabled'],
        sources: {
          effectiveSlug: 'theme-override',
          effectiveAliases: 'theme-override',
          effectiveRecipe: 'theme-override',
          effectiveTitle: 'theme-override',
          effectiveThemeLayout: 'theme-override',
          install: 'theme-override',
          prerequisiteReady: 'declaration',
          status: 'theme-override',
        },
      }),
    );
  });

  it('uses caller-supplied site state to gate readiness without mutating declarations', () => {
    registerStoreIndex(registry);

    const [resolved] = service.resolveAll({
      siteState: {
        byCapability: {
          catalog: {
            status: 'blocked',
            prerequisitesReady: false,
            reasons: ['catalog-disabled'],
          },
        },
      },
    });

    expect(resolved.status).toBe('blocked');
    expect(resolved.prerequisiteReady).toBe(false);
    expect(resolved.reasons).toEqual(['catalog-disabled']);
    expect(resolved.sources.status).toBe('site-state');
    expect(registry.list()[0]).toEqual(
      expect.objectContaining({
        defaultSlug: '/shop',
        recipe: 'ecommerce.store-index',
        required: true,
      }),
    );
  });

  it('records provenance from both theme overrides and merged site-state matches', () => {
    registerStoreIndex(registry);

    const input: PluginDefaultPageContractResolutionInput = {
      overrides: [
        {
          contract: {
            namespace: 'org.fromcode',
            pluginSlug: 'ecommerce',
            key: 'store-index',
          },
          slug: '/shop-now',
        },
      ],
      siteState: {
        byCanonicalKey: {
          'org.fromcode:ecommerce:store-index': {
            status: 'ready',
            reasons: ['contract-known'],
          },
        },
        byCapability: {
          catalog: {
            status: 'blocked',
            prerequisitesReady: false,
            reasons: ['capability-missing'],
          },
        },
      },
    };

    const [resolved] = service.resolveAll(input);

    expect(resolved.status).toBe('blocked');
    expect(resolved.reasons).toEqual(['contract-known', 'capability-missing']);
    expect(resolved.provenance).toEqual({
      overrideApplied: true,
      overrideCanonicalKey: 'org.fromcode:ecommerce:store-index',
      siteStateMatch: 'both',
    });
    expect(resolved.sources.effectiveSlug).toBe('theme-override');
    expect(resolved.sources.status).toBe('site-state');
  });

  it('rejects duplicate overrides for the same canonical contract', () => {
    registerStoreIndex(registry);

    expect(() => {
      service.resolveAll({
        overrides: [
          {
            contract: {
              namespace: 'org.fromcode',
              pluginSlug: 'ecommerce',
              key: 'store-index',
            },
            slug: '/shop',
          },
          {
            contract: {
              namespace: 'org.fromcode',
              pluginSlug: 'ecommerce',
              key: 'store-index',
            },
            slug: '/catalog',
          },
        ],
      });
    }).toThrow('duplicate theme override for default page contract: org.fromcode:ecommerce:store-index');
  });

  it('does not leak resolved mutations back into the registry boundary', () => {
    registerStoreIndex(registry);

    const [resolved] = service.resolveAll();
    resolved.dependencies.push('email');
    resolved.adoptionHints.push('/mutated');
    resolved.aliases = ['/mutated-base'];
    resolved.effectiveAliases.push('/mutated-effective');

    expect(registry.list()).toEqual([
      expect.objectContaining({
        canonicalKey: 'org.fromcode:ecommerce:store-index',
        dependencies: ['search'],
        adoptionHints: ['/shop'],
        aliases: ['/catalog'],
      }),
    ]);
    expect(service.resolveAll()[0].effectiveAliases).toEqual(['/catalog']);
  });

  it('returns contracts in deterministic canonical key order', () => {
    registerContracts(registry, [
      {
        namespace: 'org.fromcode',
        pluginSlug: 'privacy',
        contracts: [
          {
            key: 'privacy-policy-page',
            kind: 'policy',
            defaultSlug: '/privacy-policy',
            capability: 'compliance',
            recipe: 'privacy.privacy-policy-page',
            materializationMode: 'singleton-document',
            dependencies: ['audit'],
            adoptionHints: ['/privacy-policy'],
            required: true,
          },
        ],
      },
      {
        namespace: 'org.fromcode',
        pluginSlug: 'ecommerce',
        contracts: [
          {
            key: 'store-index',
            kind: 'index',
            defaultSlug: '/shop',
            capability: 'catalog',
            recipe: 'ecommerce.store-index',
            materializationMode: 'singleton-document',
            dependencies: ['search'],
            adoptionHints: ['/shop'],
            required: true,
          },
        ],
      },
    ]);

    expect(service.resolveAll().map((entry) => entry.canonicalKey)).toEqual([
      'org.fromcode:ecommerce:store-index',
      'org.fromcode:privacy:privacy-policy-page',
    ]);
  });
});

function registerContracts(
  registry: PluginDefaultPageContractRegistryService,
  registrations: PluginDefaultPageContractRegistration[],
): void {
  for (const registration of registrations) {
    registry.register(registration);
  }
}

function registerStoreIndex(registry: PluginDefaultPageContractRegistryService): void {
  registerContracts(registry, [
    {
      namespace: 'org.fromcode',
      pluginSlug: 'ecommerce',
      contracts: [
        {
          key: 'store-index',
          kind: 'index',
          defaultSlug: '/shop',
          capability: 'catalog',
          recipe: 'ecommerce.store-index',
          materializationMode: 'singleton-document',
          dependencies: ['search'],
          adoptionHints: ['/shop'],
          aliases: ['/catalog'],
          required: true,
        },
      ],
    },
  ]);
}