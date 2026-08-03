import { beforeEach, describe, expect, it } from 'vitest';
import type { IPluginDefaultPageContractRegistration } from '@core/default-page-contract/interfaces/plugin-default-page-contract-registration.interface';
import type { IPluginDefaultPageContractResolutionInput } from '@core/default-page-contract/interfaces/plugin-default-page-contract-resolution-input.interface';
import { PluginDefaultPageContractRegistryService } from '@core/services/default-page-contract/plugin-default-page-contract-registry-service';
import { PluginDefaultPageContractResolutionService } from '@core/services/default-page-contract/plugin-default-page-contract-resolution-service';
import { PluginDefaultPageContractResolutionSource } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-source.enum';
import { PluginDefaultPageContractResolutionStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-resolution-status.enum';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';
import { PluginDefaultPageContractSiteStateMatch } from '@core/default-page-contract/enums/plugin-default-page-contract-site-state-match.enum';
import { PluginDefaultPageContractKind } from '@core/default-page-contract/enums/plugin-default-page-contract-kind.enum';
import { PluginDefaultPageContractDependency } from '@core/default-page-contract/enums/plugin-default-page-contract-dependency.enum';

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
            kind: PluginDefaultPageContractKind.FORM_PAGE,
            defaultSlug: '/contact',
            capability: 'contact-form',
            recipe: 'contact-module.contact-page',
            title: 'Contact',
            themeLayout: 'FormLayout',
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            dependencies: [PluginDefaultPageContractDependency.NAVIGATION],
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
        status: PluginDefaultPageContractResolutionStatus.READY,
        reasons: [],
        sources: expect.objectContaining({
          effectiveSlug: PluginDefaultPageContractResolutionSource.DECLARATION,
          effectiveAliases: PluginDefaultPageContractResolutionSource.DECLARATION,
          effectiveRecipe: PluginDefaultPageContractResolutionSource.DECLARATION,
          install: PluginDefaultPageContractResolutionSource.DECLARATION,
          status: PluginDefaultPageContractResolutionSource.DECLARATION,
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
        status: PluginDefaultPageContractResolutionStatus.SKIPPED,
        reasons: ['install-disabled'],
        sources: {
          effectiveSlug: PluginDefaultPageContractResolutionSource.THEME_OVERRIDE,
          effectiveAliases: PluginDefaultPageContractResolutionSource.THEME_OVERRIDE,
          effectiveRecipe: PluginDefaultPageContractResolutionSource.THEME_OVERRIDE,
          effectiveTitle: PluginDefaultPageContractResolutionSource.THEME_OVERRIDE,
          effectiveThemeLayout: PluginDefaultPageContractResolutionSource.THEME_OVERRIDE,
          // Added to the resolver's `sources` after this expectation was written — the drift went
          // unnoticed because the file was never collected by the test runner.
          effectiveStyleVariant: PluginDefaultPageContractResolutionSource.DECLARATION,
          install: PluginDefaultPageContractResolutionSource.THEME_OVERRIDE,
          prerequisiteReady: PluginDefaultPageContractResolutionSource.DECLARATION,
          status: PluginDefaultPageContractResolutionSource.THEME_OVERRIDE,
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
            status: PluginDefaultPageContractResolutionStatus.BLOCKED,
            prerequisitesReady: false,
            reasons: ['catalog-disabled'],
          },
        },
      },
    });

    expect(resolved.status).toBe(PluginDefaultPageContractResolutionStatus.BLOCKED);
    expect(resolved.prerequisiteReady).toBe(false);
    expect(resolved.reasons).toEqual(['catalog-disabled']);
    expect(resolved.sources.status).toBe(PluginDefaultPageContractResolutionSource.SITE_STATE);
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

    const input: IPluginDefaultPageContractResolutionInput = {
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
            status: PluginDefaultPageContractResolutionStatus.READY,
            reasons: ['contract-known'],
          },
        },
        byCapability: {
          catalog: {
            status: PluginDefaultPageContractResolutionStatus.BLOCKED,
            prerequisitesReady: false,
            reasons: ['capability-missing'],
          },
        },
      },
    };

    const [resolved] = service.resolveAll(input);

    expect(resolved.status).toBe(PluginDefaultPageContractResolutionStatus.BLOCKED);
    expect(resolved.reasons).toEqual(['contract-known', 'capability-missing']);
    expect(resolved.provenance).toEqual({
      overrideApplied: true,
      overrideCanonicalKey: CATALOG_CANONICAL_KEY,
      siteStateMatch: PluginDefaultPageContractSiteStateMatch.BOTH,
    });
    expect(resolved.sources.effectiveSlug).toBe(PluginDefaultPageContractResolutionSource.THEME_OVERRIDE);
    expect(resolved.sources.status).toBe(PluginDefaultPageContractResolutionSource.SITE_STATE);
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
        dependencies: [PluginDefaultPageContractDependency.SEARCH],
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
            kind: PluginDefaultPageContractKind.POLICY,
            defaultSlug: '/primary-policy',
            capability: 'compliance',
            recipe: 'policy-module.primary-policy-page',
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            dependencies: [PluginDefaultPageContractDependency.AUDIT],
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
            kind: PluginDefaultPageContractKind.INDEX,
            defaultSlug: '/catalog',
            capability: 'catalog',
            recipe: 'catalog-module.catalog-index',
            materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
            dependencies: [PluginDefaultPageContractDependency.SEARCH],
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
  registrations: IPluginDefaultPageContractRegistration[],
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
          kind: PluginDefaultPageContractKind.INDEX,
          defaultSlug: '/catalog',
          capability: 'catalog',
          recipe: 'catalog-module.catalog-index',
          materializationMode: PluginDefaultPageContractMaterializationMode.SINGLETON_DOCUMENT,
          dependencies: [PluginDefaultPageContractDependency.SEARCH],
          adoptionHints: ['/catalog'],
          aliases: ['/browse'],
          required: true,
        },
      ],
    },
  ]);
}