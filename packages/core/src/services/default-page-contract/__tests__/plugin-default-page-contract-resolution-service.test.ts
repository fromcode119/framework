import { beforeEach, describe, expect, it } from 'vitest';
import type {
  PluginDefaultPageContractRegistration,
  PluginDefaultPageContractResolutionInput,
} from '../../../types';
import { PluginDefaultPageContractRegistryService } from '../plugin-default-page-contract-registry-service';
import { PluginDefaultPageContractResolutionService } from '../plugin-default-page-contract-resolution-service';

const TEST_NAMESPACE = 'org.synthetic';
const CONTACT_CANONICAL_KEY = 'org.synthetic:contact-module:contact-page';
const CATALOG_CANONICAL_KEY = 'org.synthetic:catalog-module:catalog-index';
const POLICY_CANONICAL_KEY = 'org.synthetic:policy-module:primary-policy-page';

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
        namespace: TEST_NAMESPACE,
        pluginSlug: 'contact-module',
        contracts: [
          {
            key: 'contact-page',
            kind: 'form-page',
            defaultSlug: '/contact',
            capability: 'contact-form',
            recipe: 'contact-module.contact-page',
            title: 'Contact',
            themeLayout: 'FormLayout',
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
        canonicalKey: CONTACT_CANONICAL_KEY,
        effectiveSlug: '/contact',
        effectiveAliases: ['/reach-us'],
        effectiveRecipe: 'contact-module.contact-page',
        effectiveTitle: 'Contact',
        effectiveThemeLayout: 'FormLayout',
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
            namespace: TEST_NAMESPACE,
            pluginSlug: 'catalog-module',
            key: 'catalog-index',
          },
          slug: '/cosmic-box',
          aliases: ['/catalog', '/browse'],
          title: 'Catalog',
          themeLayout: 'CatalogLayout',
          recipe: 'theme.catalog-index',
          install: false,
        },
      ],
    });

    expect(resolved).toEqual(
      expect.objectContaining({
        effectiveSlug: '/cosmic-box',
        effectiveAliases: ['/catalog', '/browse'],
        effectiveRecipe: 'theme.catalog-index',
        effectiveTitle: 'Catalog',
        effectiveThemeLayout: 'CatalogLayout',
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
        defaultSlug: '/catalog',
        recipe: 'catalog-module.catalog-index',
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
            namespace: TEST_NAMESPACE,
            pluginSlug: 'catalog-module',
            key: 'catalog-index',
          },
          slug: '/catalog-now',
        },
      ],
      siteState: {
        byCanonicalKey: {
          [CATALOG_CANONICAL_KEY]: {
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
      overrideCanonicalKey: CATALOG_CANONICAL_KEY,
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
              namespace: TEST_NAMESPACE,
              pluginSlug: 'catalog-module',
              key: 'catalog-index',
            },
            slug: '/catalog',
          },
          {
            contract: {
              namespace: TEST_NAMESPACE,
              pluginSlug: 'catalog-module',
              key: 'catalog-index',
            },
            slug: '/browse',
          },
        ],
      });
    }).toThrow(`duplicate theme override for default page contract: ${CATALOG_CANONICAL_KEY}`);
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
        canonicalKey: CATALOG_CANONICAL_KEY,
        dependencies: ['search'],
        adoptionHints: ['/catalog'],
        aliases: ['/browse'],
      }),
    ]);
    expect(service.resolveAll()[0].effectiveAliases).toEqual(['/browse']);
  });

  it('returns contracts in deterministic canonical key order', () => {
    registerContracts(registry, [
      {
        namespace: TEST_NAMESPACE,
        pluginSlug: 'policy-module',
        contracts: [
          {
            key: 'primary-policy-page',
            kind: 'policy',
            defaultSlug: '/primary-policy',
            capability: 'compliance',
            recipe: 'policy-module.primary-policy-page',
            materializationMode: 'singleton-document',
            dependencies: ['audit'],
            adoptionHints: ['/primary-policy'],
            required: true,
          },
        ],
      },
      {
        namespace: TEST_NAMESPACE,
        pluginSlug: 'catalog-module',
        contracts: [
          {
            key: 'catalog-index',
            kind: 'index',
            defaultSlug: '/catalog',
            capability: 'catalog',
            recipe: 'catalog-module.catalog-index',
            materializationMode: 'singleton-document',
            dependencies: ['search'],
            adoptionHints: ['/catalog'],
            required: true,
          },
        ],
      },
    ]);

    expect(service.resolveAll().map((entry) => entry.canonicalKey)).toEqual([
      CATALOG_CANONICAL_KEY,
      POLICY_CANONICAL_KEY,
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
      namespace: TEST_NAMESPACE,
      pluginSlug: 'catalog-module',
      contracts: [
        {
          key: 'catalog-index',
          kind: 'index',
          defaultSlug: '/catalog',
          capability: 'catalog',
          recipe: 'catalog-module.catalog-index',
          materializationMode: 'singleton-document',
          dependencies: ['search'],
          adoptionHints: ['/catalog'],
          aliases: ['/browse'],
          required: true,
        },
      ],
    },
  ]);
}